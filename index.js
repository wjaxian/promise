const Promise = require('./promise')

new Promise((resolve, reject) => {
  setTimeout(() => {
    resolve('测试')
  }, 3000)
}).then(data => {
  console.log(data)
  return a
}).catch(err => {
  console.log(err)
})