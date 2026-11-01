package expo.modules.greeter

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

/**
 * Public only for Expo's autolinking.
 *
 * @suppress
 */
class ExpoGreeterModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoGreeter")

    Events("onChange")

    Constant("defaultName") {
      Greeter.DEFAULT_NAME
    }

    Function("hello") { options: GreetingOptions? ->
      Greeter.greet(options ?: GreetingOptions())
    }

    AsyncFunction("setValueAsync") { value: String ->
      sendEvent("onChange", mapOf(
        "value" to value
      ))
    }
  }
}

/**
 * Options for [Greeter.greet], also passed from JavaScript to `hello`.
 *
 * @constructor Creates options with the defaults.
 */
class GreetingOptions : Record {
  /** Who to greet. Defaults to [Greeter.DEFAULT_NAME]. */
  @Field
  var name: String = Greeter.DEFAULT_NAME

  /** Ends the greeting with `!` instead of `.`. Defaults to `false`. */
  @Field
  var excited: Boolean = false
}

/** Builds greetings, for native code that greets without going through JavaScript. */
object Greeter {
  /** The name [greet] uses when [GreetingOptions.name] is not set. */
  const val DEFAULT_NAME = "world"

  /** Returns a greeting such as `Hello, world.` */
  fun greet(options: GreetingOptions): String =
    "Hello, ${options.name}${if (options.excited) "!" else "."}"
}
