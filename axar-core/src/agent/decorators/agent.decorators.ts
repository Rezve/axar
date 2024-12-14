import "reflect-metadata";
import { z, ZodSchema, ZodObject } from "zod";
import { META_KEYS } from "./meta-keys";
import { toZodSchema } from "./schema-generator";
import { ClassConstructor, ToolMetadata } from "./types";

/**
 * `model` decorator to associate a model identifier with a class.
 *
 * @param modelIdentifier - The model identifier string.
 * @returns A class decorator function.
 */
export function model(modelIdentifier: string): ClassDecorator {
  // Define the class decorator with the correct signature
  const classDecorator: ClassDecorator = function (
    constructor: Function
  ): void {
    Reflect.defineMetadata(META_KEYS.MODEL, modelIdentifier, constructor);
  };

  return classDecorator;
}

/**
 * `@output` decorator to define the output schema for an agent.
 * Supports both ZodSchema and class-based schemas.
 *
 * @param schemaOrClass - A ZodSchema instance or a class constructor decorated with @schema.
 * @returns A class decorator function.
 */
export function output(
  schemaOrClass: ZodSchema<any> | ClassConstructor
): ClassDecorator {
  return function (target: Function): void {
    let zodSchema: ZodSchema<any>;

    if (schemaOrClass instanceof ZodSchema) {
      // Directly use the provided ZodSchema
      zodSchema = schemaOrClass;
    } else {
      // Assume it's a class constructor decorated with @schema
      zodSchema = toZodSchema(schemaOrClass);
    }

    // Store the ZodSchema in metadata for the Agent base class to retrieve
    Reflect.defineMetadata(META_KEYS.OUTPUT_SCHEMA, zodSchema, target);
  };
}

/**
 * `systemPrompt` decorator to set system prompts for classes and methods.
 *
 * Usage:
 * - As a Class Decorator: @systemPrompt("Your system prompt here.")
 * - As a Method Decorator: @systemPrompt
 *
 * When used as a method decorator, the decorated method must return a string.
 * The returned string is added to the system prompts.
 *
 * @param prompt - (Optional) The system prompt string.
 * @returns A decorator function.
 */

// Function Overloads
export function systemPrompt(prompt: string): ClassDecorator;
export function systemPrompt(): MethodDecorator;

// Implementation
export function systemPrompt(
  prompt?: string
): ClassDecorator | MethodDecorator {
  // Class Decorator
  if (typeof prompt === "string") {
    const classDecorator: ClassDecorator = function (
      constructor: Function
    ): void {
      const systemPrompts =
        Reflect.getMetadata(META_KEYS.SYSTEM_PROMPTS, constructor) || [];

      // Add class prompt to the beginning
      systemPrompts.unshift(async () => prompt);

      Reflect.defineMetadata(
        META_KEYS.SYSTEM_PROMPTS,
        systemPrompts,
        constructor
      );
    };
    return classDecorator;
  } else {
    // Method Decorator
    const methodDecorator: MethodDecorator = function (
      target: Object,
      propertyKey: string | symbol,
      descriptor: PropertyDescriptor
    ): void | PropertyDescriptor {
      if (typeof descriptor.value !== "function") {
        throw new Error(
          `@systemPrompt can only be applied to methods, not to property '${String(
            propertyKey
          )}'.`
        );
      }

      // Retrieve existing system prompts or initialize
      const systemPrompts =
        Reflect.getMetadata(META_KEYS.SYSTEM_PROMPTS, target.constructor) || [];
      systemPrompts.push(async function (this: any) {
        const result = await descriptor.value.apply(this); // Use the actual instance's `this`
        if (typeof result !== "string") {
          throw new Error(
            `Method '${String(
              propertyKey
            )}' decorated with @systemPrompt must return a string.`
          );
        }
        return result;
      });

      Reflect.defineMetadata(
        META_KEYS.SYSTEM_PROMPTS,
        systemPrompts,
        target.constructor
      );

      return descriptor;
    };
    return methodDecorator;
  }
}

/**
 * `@tool` decorator to mark a method as a tool with a description and schema.
 * Supports both explicit ZodSchema and class-based schema derivation.
 *
 * Usage with ZodSchema:
 * @tool("Description", z.object({ ... }))
 *
 * Usage with class-based schema:
 * @tool("Description")
 * async method(params: ClassBasedParams): Promise<ReturnType> { ... }
 *
 * @param description - Description of the tool's functionality.
 * @param schemaOrClass - Optional Zod schema or class constructor.
 * @returns A method decorator function.
 */
export function tool(
  description: string,
  schemaOrClass?: ZodSchema<any> | ClassConstructor
): MethodDecorator {
  return function (
    target: Object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): void | PropertyDescriptor {
    let schema: ZodSchema<any>;

    if (schemaOrClass) {
      if (schemaOrClass instanceof z.ZodSchema) {
        // Explicit Zod schema provided
        schema = schemaOrClass;
      } else {
        // Assume it's a class constructor decorated with @schema
        schema = toZodSchema(schemaOrClass);
      }
    } else {
      // No schema provided, derive via reflection
      const paramTypes: any[] = Reflect.getMetadata(
        "design:paramtypes",
        target,
        propertyKey
      );

      if (!paramTypes || paramTypes.length === 0) {
        throw new Error(
          `@tool decorator on ${String(
            propertyKey
          )} requires at least one parameter or an explicit schema.`
        );
      }

      const paramType = paramTypes[0];

      // Check if paramType is a class decorated with @schema
      const hasSchema = Reflect.hasMetadata(META_KEYS.SCHEMA, paramType);
      if (!hasSchema) {
        throw new Error(
          `@tool decorator on ${String(
            propertyKey
          )} requires an explicit Zod schema or a parameter class decorated with @schema.`
        );
      }

      // Convert the parameter class to Zod schema
      schema = toZodSchema(paramType);
    }

    // Retrieve existing tools metadata or initialize an empty array
    const tools: ToolMetadata[] =
      Reflect.getMetadata(META_KEYS.TOOLS, target.constructor) || [];

    // Add the new tool to the metadata
    tools.push({
      name: String(propertyKey),
      description,
      method: String(propertyKey),
      parameters: schema as ZodObject<any>,
    });

    // Define the updated tools metadata on the constructor
    Reflect.defineMetadata(META_KEYS.TOOLS, tools, target.constructor);

    // Wrap the original method to validate input
    const originalMethod = descriptor.value;
    descriptor.value = function (...args: any[]) {
      if (args[0]) {
        schema.parse(args[0]); // This will throw if validation fails
      }
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}
