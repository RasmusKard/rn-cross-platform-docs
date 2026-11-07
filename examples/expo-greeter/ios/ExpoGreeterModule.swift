import ExpoModulesCore

@_documentation(visibility: internal)
public class ExpoGreeterModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoGreeter")

    Events("onChange")

    Constant("defaultName") {
      Greeter.defaultName
    }

    Function("hello") { (options: GreetingOptions?) in
      return Greeter.greet(options ?? GreetingOptions())
    }

    AsyncFunction("setValueAsync") { (value: String) in
      self.sendEvent("onChange", [
        "value": value
      ])
    }
  }
}

/// Options for ``Greeter/greet(_:)``, also passed from JavaScript to `hello`.
public struct GreetingOptions: Record {
  /// Creates options with the defaults.
  public init() {}

  /// Who to greet. Defaults to ``Greeter/defaultName``, `"world"`.
  @Field public var name: String = Greeter.defaultName

  /// Ends the greeting with `!` instead of `.`. Defaults to `false`.
  @Field public var excited: Bool = false
}

/// Builds greetings, for native code that greets without going through JavaScript.
public enum Greeter {
  /// The name ``greet(_:)`` uses when the options leave ``GreetingOptions/name`` unset: `"world"`.
  public static let defaultName = "world"

  /// Returns a greeting such as `"Hello, world."`.
  ///
  /// ```swift
  /// let options = GreetingOptions()
  /// options.name = "Ada"
  /// options.excited = true
  /// Greeter.greet(options) // "Hello, Ada!"
  /// ```
  public static func greet(_ options: GreetingOptions) -> String {
    "Hello, \(options.name)\(options.excited ? "!" : ".")"
  }
}
