# frozen_string_literal: true

require "erb"
require "fileutils"
require_relative "converter"

module Docs
  # Renders cosmonats' `docs/<n>-<slug>.md` into `docs/<slug>.html`, one page per file, ordered by `<n>`.
  class Builder
    GROUPS = {
      "Getting started" => %w[introduction installation quick-start],
      "Core concepts" => %w[jobs streams configuration],
      "Advanced usage" => %w[cron priority-queues-and-lanes batches concurrency-limiting serializers error-handling
                             middleware testing],
      "Integrations" => %w[active-job sentry],
      "Operations" => %w[cli deployment monitoring examples upgrading]
    }.freeze
    FALLBACK_GROUP = "More"
    EDIT_URL = "https://github.com/bitsbeam/cosmonats/blob/main/docs/%s"

    Page = Struct.new(:file, :number, :slug, :title, :group, :body, :headings, :description, keyword_init: true) do
      def href = "#{slug}.html"
    end

    def initialize(source:, output:, template:)
      @source = source
      @output = output
      @template = ERB.new(File.read(template, encoding: "UTF-8"), trim_mode: "-")
    end

    def build
      pages = load_pages
      abort "No docs found in #{@source}/docs" if pages.empty?

      FileUtils.rm_rf(@output)
      FileUtils.mkdir_p(@output)
      pages.each_with_index do |page, index|
        html = render(page, pages, index.zero? ? nil : pages[index - 1], pages[index + 1])
        File.write(File.join(@output, page.href), html)
      end
      File.write(File.join(@output, "index.html"), redirect(pages.first))
      pages
    end

    def version
      File.read(File.join(@source, "lib/cosmo/version.rb"))[/VERSION = "([^"]+)"/, 1]
    end

    private

    def load_pages
      files = Dir[File.join(@source, "docs", "*.md")].filter_map do |path|
        match = File.basename(path).match(/\A(\d+)-([\w-]+)\.md\z/)
        [Integer(match[1]), match[2], path] if match
      end
      files.sort.map { |number, slug, path| build_page(number, slug, path) }
    end

    def build_page(number, slug, path)
      markdown = File.read(path, encoding: "UTF-8")
      document = Kramdown::Document.new(markdown, input: "GFM", hard_wrap: false, auto_ids: true,
                                                  syntax_highlighter: nil)
      headings = []
      body, = Converter.convert(document.root, document.options.merge(headings: headings))
      Page.new(file: File.basename(path), number: number, slug: slug,
               title: markdown[/^# (.+)$/, 1].to_s.strip, group: group_of(slug),
               body: body, headings: headings, description: description_of(markdown))
    end

    def group_of(slug)
      GROUPS.find { |_, slugs| slugs.include?(slug) }&.first || FALLBACK_GROUP
    end

    def description_of(markdown)
      paragraph = markdown.split(/\n{2,}/).find { |block| block.match?(/\A[A-Za-z`*]/) && !block.start_with?("#") }
      paragraph.to_s.gsub(/[`*]|\[([^\]]+)\]\([^)]+\)/) { Regexp.last_match(1).to_s }.gsub(/\s+/, " ").strip[0, 180]
    end

    def render(page, pages, previous_page, next_page)
      groups = pages.group_by(&:group)
      version = self.version
      edit_url = format(EDIT_URL, page.file)
      @template.result(binding)
    end

    def redirect(page)
      <<~HTML
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <title>Cosmonats docs</title>
          <meta http-equiv="refresh" content="0; url=#{page.href}">
          <link rel="canonical" href="#{page.href}">
        </head>
        <body><a href="#{page.href}">#{page.title}</a></body>
        </html>
      HTML
    end
  end
end
