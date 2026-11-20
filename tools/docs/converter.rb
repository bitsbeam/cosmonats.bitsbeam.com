# frozen_string_literal: true

require "kramdown"
require "kramdown-parser-gfm"
require_relative "highlighter"

module Docs
  # Kramdown's HTML converter, dressed in the site's components: code blocks,
  # inline code, tables, GitHub alerts, and links between docs pages.
  class Converter < Kramdown::Converter::Html
    ALERTS = { "NOTE" => "Note", "TIP" => "Tip", "IMPORTANT" => "Important", "WARNING" => "Warning",
               "CAUTION" => "Caution" }.freeze
    ALERT = /\A\[!(#{ALERTS.keys.join("|")})\]\s*/

    def initialize(root, options)
      super
      @headings = options.fetch(:headings, [])
    end

    def convert_codeblock(el, _indent)
      language = el.options[:lang] || el.attr["class"].to_s[/language-(\S+)/, 1] || "text"
      code = el.value.chomp
      <<~HTML
        <figure class="code-block docs-code">
          <figcaption class="code-block__head"><span class="code-block__lang">#{escape_html(language)}</span><button class="copy-btn" type="button" data-copy="#{escape_html(code, :attribute)}"><span data-copy-label>copy</span></button></figcaption>
        <pre><code>#{Highlighter.highlight(code, language)}</code></pre>
        </figure>
      HTML
    end

    def convert_codespan(el, _indent)
      %(<code class="inline">#{escape_html(el.value)}</code>)
    end

    def convert_header(el, indent)
      return "" if el.options[:level] == 1

      id = el.attr["id"] || generate_id(el.options[:raw_text])
      @headings << { id: id, html: inner(el, indent), level: el.options[:level] } if el.options[:level] == 2
      level = el.options[:level]
      %(<h#{level} id="#{id}"><a class="docs-anchor" href="##{id}" aria-hidden="true" tabindex="-1">#</a>#{inner(el, indent)}</h#{level}>\n)
    end

    def convert_a(el, indent)
      el.attr["href"] = Links.rewrite(el.attr["href"].to_s)
      el.attr["rel"] = "noopener" if el.attr["href"].start_with?("http")
      super
    end

    def convert_table(el, indent)
      el.attr["class"] = "docs-table"
      %(<div class="table-wrap">#{super}</div>\n)
    end

    def convert_blockquote(el, indent)
      first = el.children.first
      text = first&.type == :p && first.children.first&.type == :text ? first.children.first : nil
      kind = text && text.value[ALERT, 1]
      return %(<blockquote class="docs-quote">\n#{inner(el, indent)}</blockquote>\n) unless kind

      text.value = text.value.sub(ALERT, "")
      %(<aside class="panel crew-note docs-alert docs-alert--#{kind.downcase}"><span class="crew-note__label">) +
        %(#{ALERTS[kind]}</span>\n#{inner(el, indent)}</aside>\n)
    end
  end

  # Links written for GitHub (`9-batches.md#notes`, `../lib/...`) pointed at their pages on the site.
  module Links
    REPOSITORY = "https://github.com/bitsbeam/cosmonats/blob/main"

    def self.rewrite(href)
      return href if href.empty? || href.start_with?("#") || href.match?(/\A[a-z]+:/i)

      path, anchor = href.split("#", 2)
      target = if (page = path[/\A(?:\.\/)?\d+-([\w-]+)\.md\z/, 1])
                 "#{page}.html"
               else
                 "#{REPOSITORY}/#{File.expand_path(path, "/docs").delete_prefix("/")}"
               end
      anchor ? "#{target}##{anchor}" : target
    end
  end
end
