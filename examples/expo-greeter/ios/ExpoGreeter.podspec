require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoGreeter'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = package['author']
  s.homepage       = package['homepage']
  s.platforms      = {
    :ios => '16.4',
    :tvos => '16.4'
  }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/RasmusKard/rn-cross-platform-docs' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    # the documentation catalog, which CocoaPods can't add as a source
    'OTHER_DOCC_FLAGS' => '$(inherited) "$(PODS_TARGET_SRCROOT)/ExpoGreeter.docc"',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
