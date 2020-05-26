const {
  PENDING,
  FULFILLED,
  REJECTED,
  getType,
  isArray,
  isObject,
  isFunction
} = {
  PENDING: 'pending',
  FULFILLED: 'fulfilled',
  REJECTED: 'rejected',
  getType: (t) => (v) => Object.prototype.toString.call(v) === `[object ${t}]`,
  isArray: (v) => getType('Array')(v),
  isObject: (v) => getType('Object')(v),
  isFunction: (v) => getType('Function')(v),
}

// 解析promise，这里将会处理返回的promise或者其它情况下promise的状态让其直接变为完成状态并将参数值传入到下一个then
const resolvePromise = (promise2, x, resolve, reject) => {
  let caller = false // 定义一个开关，为了让promise的状态一旦确定则不能再做修改

  // 如果promise是它自己，避免自己等待自己，直接抛错
  if (promise2 === x) {
    return reject(
      new TypeError('Chaining cycle detected for promise #<Promise>')
    )
  }

  // 如果x是对象或者是一个函数的时候 那么它可能是一个promise，接下来将进一步解析。 这里是为了兼容第三方promise库，例如：q es6-promise
  if ((x && isObject(x)) || isFunction(x)) {
    try {
      const then = x.then
      // 确定then是一个函数的时候，那么肯定是一个promise
      if (isFunction(then)) {
        // 执行then函数
        then.call(
          x,
          y => {
            if (caller) return null
            caller = true
            // 递归解析，直到不是一个promise
            resolvePromise(promise2, y, resolve, reject)
          },
          e => {
            if (caller) return null
            caller = true
            // 如果发生错误，将直接变为拒绝状态并返回错误信息
            reject(e)
          }
        )
      } else {
        // 如果不是一个promise，则直接将其状态变为完成并返回其值
        resolve(x)
      }
    } catch (err) {
      if (caller) return null
      caller = true
      // 发生错误这里直接将状态变为拒绝并返回错误信息
      reject(err)
    }
  } else {
    // 当x是一个普通值，那么将直接变为完成状态，并返回其值
    resolve(x)
  }
}

// 专门用来处理then的onFulfilled Or onRejected 回调
const onFulfilledOrOnRejectedHandler = (
  promise2,
  onFulfilledOrOnRejectedCallBack,
  resolve,
  reject,
  value
) => {
  // 此处的定时器为了等待Promise的实例完成
  setTimeout(() => {
    try {
      // 执行then的resolve or reject函数并传入其值,通过一个变量x去拿到当前resolve执行后的返回值
      const x = onFulfilledOrOnRejectedCallBack(value)
      // 解析then的resolve or reject执行，如果返回一个promise或者其它值情况的处理
      resolvePromise(promise2, x, resolve, reject)
    } catch (err) {
      // 如果返回发生错误，则直接reject
      reject(err)
    }
  }, 0)
}

module.exports = {
  PENDING,
  FULFILLED,
  REJECTED,
  isArray,
  isObject,
  isFunction,
  onFulfilledOrOnRejectedHandler
}
