# frozen_string_literal: true

require "cgi"
require "rouge"

module Docs
  # Turns code into the site's hand-tagged `tok-*` spans, so generated pages
  # share the colors of the code samples written by hand.
  class Highlighter < Rouge::Formatter
    CLASSES = [
      ["Comment", "tok-cm"],
      ["Keyword", "tok-k"],
      ["Name.Class", "tok-c"],
      ["Name.Constant", "tok-c"],
      ["Name.Namespace", "tok-c"],
      ["Literal.String.Symbol", "tok-s"],
      ["Name.Attribute", "tok-s"],
      ["Name.Tag", "tok-s"],
      ["Literal", "tok-l"],
      ["Name.Function", "tok-m"]
    ].freeze

    SHELL_CLASSES = [["Name.Builtin", "tok-m"]].freeze

    def self.highlight(code, language)
      lexer = Rouge::Lexer.find_fancy(language.to_s) || Rouge::Lexers::PlainText
      new(lexer).format(lexer.lex(code))
    end

    def initialize(lexer)
      super()
      @classes = lexer.is_a?(Rouge::Lexers::Shell) ? SHELL_CLASSES + CLASSES : CLASSES
    end

    def stream(tokens)
      tokens.each do |token, value|
        text = CGI.escapeHTML(value)
        css = css_class(token)
        yield css ? %(<span class="#{css}">#{text}</span>) : text
      end
    end

    private

    def css_class(token)
      name = token.qualname
      @classes.find { |prefix, _| name == prefix || name.start_with?("#{prefix}.") }&.last
    end
  end
end
