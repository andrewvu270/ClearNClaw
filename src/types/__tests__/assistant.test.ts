import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  validateFunctionCall,
  FUNCTION_SCHEMAS,
  type FunctionCall,
  type AssistantFunction,
} from '../assistant'

// Arbitrary for valid assistant function names
const assistantFunctionArb = fc.constantFrom<AssistantFunction>(
  'createTask',
  'completeTask',
  'completeSubtask',
  'renameTask',
  'renameSubtask',
  'addSubtask',
  'removeSubtask',
  'deleteTask',
  'clearCompletedTasks',
  'setReminder',
  'removeReminder',
  'setRecurrence',
  'startTimer',
  'pauseTimer',
  'resumeTimer',
  'stopTimer',
  'getTimerStatus',
  'listTasks',
  'getTaskDetails',
  'getNextSubtask'
)

// Generate a valid function call with all required parameters
const validFunctionCallArb = assistantFunctionArb.chain((funcName) => {
  const schema = FUNCTION_SCHEMAS.find((s) => s.name === funcName)
  if (!schema) {
    return fc.constant({ name: funcName, arguments: {} } as FunctionCall)
  }

  // Build arguments object with all required params
  const argsArb = fc.record(
    Object.fromEntries(
      schema.requiredParams.map((param) => [
        param,
        param === 'confirmed' ? fc.boolean() : fc.string({ minLength: 1 }),
      ])
    )
  )

  return argsArb.map((args) => ({ name: funcName, arguments: args } as FunctionCall))
})

// Generate an invalid function call missing at least one required parameter
const invalidFunctionCallArb = assistantFunctionArb
  .filter((funcName) => {
    const schema = FUNCTION_SCHEMAS.find((s) => s.name === funcName)
    return schema !== undefined && schema.requiredParams.length > 0
  })
  .chain((funcName) => {
    const schema = FUNCTION_SCHEMAS.find((s) => s.name === funcName)!
    
    // Pick a random subset of required params to include (but not all)
    return fc
      .subarray(schema.requiredParams, { minLength: 0, maxLength: schema.requiredParams.length - 1 })
      .map((includedParams) => {
        const args: Record<string, unknown> = {}
        for (const param of includedParams) {
          args[param] = param === 'confirmed' ? true : 'test-value'
        }
        return { name: funcName, arguments: args } as FunctionCall
      })
  })

describe('Assistant Types', () => {
  /**
   * Feature: vapi-voice-agent, Property 8: Function calls include required parameters
   *
   * For any function call made by the Assistant, all required parameters as defined
   * in the function schema SHALL be present and valid.
   *
   * Validates: Requirements 2.2
   */
  describe('Property 8: Function calls include required parameters', () => {
    it('valid function calls with all required parameters should pass validation', () => {
      fc.assert(
        fc.property(validFunctionCallArb, (call) => {
          const result = validateFunctionCall(call)
          expect(result.valid).toBe(true)
          expect(result.missingParams).toHaveLength(0)
        }),
        { numRuns: 100 }
      )
    })

    it('function calls missing required parameters should fail validation', () => {
      fc.assert(
        fc.property(invalidFunctionCallArb, (call) => {
          const result = validateFunctionCall(call)
          const schema = FUNCTION_SCHEMAS.find((s) => s.name === call.name)!
          
          // Should be invalid
          expect(result.valid).toBe(false)
          
          // Missing params should be a subset of required params
          expect(result.missingParams.length).toBeGreaterThan(0)
          for (const missing of result.missingParams) {
            expect(schema.requiredParams).toContain(missing)
          }
        }),
        { numRuns: 100 }
      )
    })

    it('function calls with undefined values for required parameters should fail validation', () => {
      fc.assert(
        fc.property(
          assistantFunctionArb.filter((funcName) => {
            const schema = FUNCTION_SCHEMAS.find((s) => s.name === funcName)
            return schema !== undefined && schema.requiredParams.length > 0
          }),
          (funcName) => {
            const schema = FUNCTION_SCHEMAS.find((s) => s.name === funcName)!
            
            // Create args with all required params set to undefined
            const args: Record<string, unknown> = {}
            for (const param of schema.requiredParams) {
              args[param] = undefined
            }
            
            const call: FunctionCall = { name: funcName, arguments: args }
            const result = validateFunctionCall(call)
            
            expect(result.valid).toBe(false)
            expect(result.missingParams.length).toBe(schema.requiredParams.length)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
