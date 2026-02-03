import { TelegramClient, tl, User, SentCode } from '@mtcute/node'
import { text, password, isCancel, intro, outro, spinner } from '@clack/prompts'
import chalk from 'chalk'
import { withFloodWaitHandling } from './utils/flood-wait.js'

export async function checkSession(tg: TelegramClient): Promise<User | null> {
  try {
    return await tg.getMe()
  } catch (e) {
    if (tl.RpcError.is(e, 'AUTH_KEY_UNREGISTERED')) {
      return null
    }
    throw e
  }
}

export async function ensureAuthenticated(tg: TelegramClient): Promise<User> {
  intro(chalk.cyan('Telegram Authentication'))

  // Check existing session
  const s = spinner()
  s.start('Checking session...')

  const existingUser = await checkSession(tg)
  if (existingUser) {
    s.stop(chalk.green(`Already authenticated as ${existingUser.firstName}`))
    outro('Session valid!')
    return existingUser
  }
  s.stop('No valid session found')

  // Phone number
  const phone = await text({
    message: 'Enter your phone number (with country code):',
    placeholder: '+1234567890',
    validate: (value) => {
      if (!value || !value.match(/^\+?[0-9]{7,15}$/)) {
        return 'Please enter a valid phone number'
      }
    }
  })
  if (isCancel(phone)) {
    outro(chalk.yellow('Authentication cancelled'))
    process.exit(0)
  }

  // Send code
  s.start('Sending verification code...')
  const sentCodeResult = await withFloodWaitHandling(() => tg.sendCode({ phone }))

  // sendCode can return User if already logged in (with future auth tokens)
  if (sentCodeResult instanceof User) {
    s.stop(chalk.green(`Already authenticated as ${sentCodeResult.firstName}!`))
    outro('Session restored!')
    return sentCodeResult
  }

  const sentCode = sentCodeResult as SentCode
  s.stop('Code sent!')

  // Get code from user
  const code = await text({
    message: 'Enter the verification code:',
    validate: (value) => {
      if (!value || !value.match(/^[0-9]{5}$/)) {
        return 'Code should be 5 digits'
      }
    }
  })
  if (isCancel(code)) {
    outro(chalk.yellow('Authentication cancelled'))
    process.exit(0)
  }

  // Sign in
  s.start('Signing in...')
  try {
    const user = await withFloodWaitHandling(() =>
      tg.signIn({
        phone,
        phoneCodeHash: sentCode.phoneCodeHash,
        phoneCode: code
      })
    )
    s.stop(chalk.green(`Authenticated as ${user.firstName}!`))
    outro('Authentication complete!')
    return user
  } catch (e) {
    if (tl.RpcError.is(e, 'SESSION_PASSWORD_NEEDED')) {
      s.stop('2FA required')

      // 2FA password
      const twoFaPass = await password({
        message: 'Enter your 2FA password:'
      })
      if (isCancel(twoFaPass)) {
        outro(chalk.yellow('Authentication cancelled'))
        process.exit(0)
      }

      s.start('Verifying 2FA...')
      const user = await withFloodWaitHandling(() => tg.checkPassword(twoFaPass))
      s.stop(chalk.green(`Authenticated as ${user.firstName}!`))
      outro('Authentication complete!')
      return user
    }
    throw e
  }
}
