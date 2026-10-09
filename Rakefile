# frozen_string_literal: true

require "webrick"

desc "Serve the site locally (PORT=8000 by default)"
task :server do
  server = WEBrick::HTTPServer.new(Port: Integer(ENV.fetch("PORT", 8000)), DocumentRoot: __dir__)
  %w[INT TERM].each { |signal| trap(signal) { server.shutdown } }
  server.start
end

task default: :server
