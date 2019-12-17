const fs = require('fs-extra')
const path = require('path')
const inquirer = require('inquirer')
const Creator = require('./Creator')
const { clearConsole } = require('./util/clearConsole')
const { getPromptModules } = require('./util/createTools')
const { chalk, error, stopSpinner, exit } = require('@vue/cli-shared-utils')
const validateProjectName = require('validate-npm-package-name')

// vue create 执行的方法 projectName是生成的文件名，options是配置
async function create (projectName, options) {
  // 代理先放进去
  if (options.proxy) {
    process.env.HTTP_PROXY = options.proxy
  }

  const cwd = options.cwd || process.cwd() // process.cwd() 是当前执行node命令时候的文件夹地址 
  const inCurrent = projectName === '.'
  const name = inCurrent ? path.relative('../', cwd) : projectName
  const targetDir = path.resolve(cwd, projectName || '.')

  const result = validateProjectName(name)
  // 如果projectName不合规（是否合规通过validate-npm-package-name这个包来判断）
  if (!result.validForNewPackages) {
    console.error(chalk.red(`Invalid project name: "${name}"`))
    result.errors && result.errors.forEach(err => {
      console.error(chalk.red.dim('Error: ' + err))
    })
    result.warnings && result.warnings.forEach(warn => {
      console.error(chalk.red.dim('Warning: ' + warn))
    })
    exit(1)
  }

  // 如果存在了这个projectName同名文件
  if (fs.existsSync(targetDir)) {
    // 如果options里有force这个参数，则直接删了原来文件
    if (options.force) {
      await fs.remove(targetDir)
    } else {
      // 否则，就清屏，然后判断
      await clearConsole()
      // projectName === '.' ? 如果是就问‘在当前目录中生成项目？’
      if (inCurrent) {
        const { ok } = await inquirer.prompt([
          {
            name: 'ok',
            type: 'confirm',
            message: `Generate project in current directory?`
          }
        ])
        if (!ok) {
          return
        }
      } else {
        // 如果projectName不是'.'，就问是覆盖还是合并还是取消
        const { action } = await inquirer.prompt([
          {
            name: 'action',
            type: 'list',
            message: `Target directory ${chalk.cyan(targetDir)} already exists. Pick an action:`,
            choices: [
              { name: 'Overwrite', value: 'overwrite' },
              { name: 'Merge', value: 'merge' },
              { name: 'Cancel', value: false }
            ]
          }
        ])
        if (!action) {
          return
        } else if (action === 'overwrite') {
          console.log(`\nRemoving ${chalk.cyan(targetDir)}...`)
          await fs.remove(targetDir)
        }
      }
    }
  }
  // Creator在Creator中定义
  // name为projectName || '.'
  // ? targetDir为创建目标地址
  // getPromptModules方法返回的是一些库的路径
  // TODO getPromptModules暂时不知道干嘛的，待会看看Creator里面咋用的
  const creator = new Creator(name, targetDir, getPromptModules())
  await creator.create(options)
}

// 这个输出这个create方法，并且把其后的参数给到create方法里
module.exports = (...args) => {
  return create(...args).catch(err => {
    stopSpinner(false) // do not persist
    error(err)
    if (!process.env.VUE_CLI_TEST) {
      process.exit(1)
    }
  })
}
