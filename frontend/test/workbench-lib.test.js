import { describe, expect, it } from 'vitest'
import { EXAMPLE_CALL, exampleText, prepareInput } from '@/lib/workbench.js'

describe('prepareInput', () => {
  it('treats blank text as empty', () => {
    expect(prepareInput('')).toEqual({ status: 'empty' })
    expect(prepareInput('  \n ')).toEqual({ status: 'empty' })
  })

  it('reports invalid JSON', () => {
    const result = prepareInput('{"turns": [')
    expect(result.status).toBe('invalid')
    expect(result.message).toMatch(/^Not valid JSON/)
  })

  it('rejects lists and single values', () => {
    expect(prepareInput('[]').status).toBe('invalid')
    expect(prepareInput('5').status).toBe('invalid')
    expect(prepareInput('null').status).toBe('invalid')
  })

  it('fills in call_id, agent and source when they are missing', () => {
    const result = prepareInput('{"turns": []}')
    expect(result.status).toBe('ok')
    expect(result.payload).toEqual({
      call_id: 'workbench',
      agent: 'workbench',
      source: 'synthetic',
      turns: [],
    })
  })

  it('never overrides what the user wrote', () => {
    const result = prepareInput('{"call_id": "mine", "agent": "hotel-1", "source": "real", "turns": []}')
    expect(result.payload.call_id).toBe('mine')
    expect(result.payload.agent).toBe('hotel-1')
    expect(result.payload.source).toBe('real')
  })

  it('ships an example that round-trips and is marked synthetic', () => {
    const result = prepareInput(exampleText())
    expect(result.status).toBe('ok')
    expect(result.payload).toEqual(EXAMPLE_CALL)
    expect(EXAMPLE_CALL.source).toBe('synthetic')
  })
})
