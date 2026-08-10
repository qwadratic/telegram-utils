import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isPrivateChat } from '../src/sync/index.js'

test('isPrivateChat separates users from groups and channels', () => {
  assert.equal(isPrivateChat(283706115), true) // user
  assert.equal(isPrivateChat(-1003831472718), false) // supergroup/channel
  assert.equal(isPrivateChat(-5112579792), false) // basic group
  assert.equal(isPrivateChat(0), false)
})
