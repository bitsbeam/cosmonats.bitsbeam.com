# frozen_string_literal: true

require "webrick"

desc "Serve the site locally (PORT=8000 by default)"
task :server do
  server = WEBrick::HTTPServer.new(Port: Integer(ENV.fetch("PORT", 8000)), DocumentRoot: __dir__)
  %w[INT TERM].each { |signal| trap(signal) { server.shutdown } }
  server.start
end

desc "Render cosmonats' docs/*.md into docs/ (COSMONATS=path to a checkout, default projects/cosmonats)"
task :docs do
  require_relative "tools/docs/builder"

  source = File.expand_path(ENV.fetch("COSMONATS", "projects/cosmonats"), __dir__)
  builder = Docs::Builder.new(source: source, output: File.join(__dir__, "docs"),
                              template: File.join(__dir__, "tools/docs/page.html.erb"))
  pages = builder.build
  puts "Rendered #{pages.size} pages of cosmonats v#{builder.version} from #{source}"
end

task default: :server
