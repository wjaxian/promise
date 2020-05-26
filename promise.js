
const {
  PENDING,
  FULFILLED,
  REJECTED,
  isArray,
  isObject,
  isFunction,
  onFulfilledOrOnRejectedHandler
} = require('./utils')

class Promise {
  constructor(executor) {
    this.status = PENDING
    this.doneValue = undefined // 同步executor执行后，保存resolve函数参数值
    this.resason = undefined // 同步executor执行后，保存reject函数的参数值

    // 发布订阅模式。then方法执行时如发现状态未变，则订阅then方法执行的 完成 Or 拒绝 回调
    this.doneCallbacks = []
    this.failCallbacks = []

    const resolve = (doneValue) => {
      // 如果值是一个promise
      if (doneValue instanceof Promise) {
        // 将递归解析resolve中的参数直到不是一个promise对象
        return doneValue.then(resolve, reject)
      }
      // 判断只有是等待状态的时候才进行成功处理，为了一旦状态发生改变将不会再改变状态
      if (this.status === PENDING) {
        this.status = FULFILLED
        this.doneValue = doneValue

        // 执行then方法的resolve订阅回调
        this.doneCallbacks.forEach((fn) => fn())
      }
    }

    const reject = (resason) => {
      // 判断只有是等待状态的时候才进行拒绝处理，为了一旦状态发生改变将不会再改变状态
      if (this.status === PENDING) {
        this.status = REJECTED
        this.resason = resason

        // 执行then方法的reject订阅回调
        this.failCallbacks.forEach((fn) => fn())
      }
    }

    // 异常处理，一旦发生错误直接将状态变为拒绝并返回错误信息
    try {
      // 同步执行 executor promise的回调
      executor(resolve, reject)
    } catch (e) {
      reject(e)
    }
  }

  // 内部定时器的作用是为了等待Promise的实例完成后再执行
  then(onFulfilled, onRejected) {
    // 如果 onFulfilled Or onRejected 不是函数，则将其忽略，默认赋值一个函数返回其值，为了让值往下穿透
    onFulfilled = isFunction(onFulfilled) ? onFulfilled : v => v
    onRejected = isFunction(onRejected) ? onRejected : (err) => { throw err }

    // then的执行必须返回一个新的promise，形成无限链式调用（也就是形成递归）
    const promise2 = new Promise((resolve, reject) => {
      let value = ''
      let onFulfilledOrOnRejectedCallBack = ''
      // 如果状态已变成完成状态 则保存onFulfilled回调 并保存完成的donevalue
      if (this.status === FULFILLED) {
        onFulfilledOrOnRejectedCallBack = onFulfilled
        value = this.doneValue
      }

      // 如果状态已变成完成状态 则保存onRejected回调 并保存拒绝的resason
      if (this.status === REJECTED) {
        onFulfilledOrOnRejectedCallBack = onRejected
        value = this.resason
      }

      // 执行对应状态的 onFulfilled Or onRejected 并传入对应的value
      if (isFunction(onFulfilledOrOnRejectedCallBack)) {
        setTimeout(() => {
          onFulfilledOrOnRejectedHandler(
            promise2,
            onFulfilledOrOnRejectedCallBack,
            resolve,
            reject,
            value
          )
        }, 0)
      }

      // 如果状态不变
      if (this.status === PENDING) {
        // 订阅then的完成回调
        this.doneCallbacks.push(() => {
          setTimeout(() => {
            onFulfilledOrOnRejectedHandler(
              promise2,
              onFulfilled,
              resolve,
              reject,
              this.doneValue
            )
          }, 0)
        })

        // 订阅then的拒绝回调
        this.failCallbacks.push(() => {
          setTimeout(() => {
            onFulfilledOrOnRejectedHandler(
              promise2,
              onRejected,
              resolve,
              reject,
              this.resason
            )
          }, 0)
        })
      }
    })

    return promise2
  }

  // catch的回调利用then方法的实现
  catch(failCallback) {
    return this.then(null, failCallback)
  }

  // finally 是无论如何都会执行的
  // 如果返回一个promise，那么将会等待这个promise执行完毕
  finally(callback) {
    return this.then(
      x => Promise.resolve(callback()).then(() => x),
      e =>
        Promise.reject(callback()).then(() => {
          throw e
        })
    )
  }

  // resolve 的静态方法
  static resolve(v) {
    return new Promise((resolve) => {
      resolve(v)
    })
  }

  // reject 的静态方法
  static reject(err) {
    return new Promise((resolve, reject) => {
      reject(err)
    })
  }

  static all(promises) {
    // 看一下进来的参数是不是一个数组
    promises = isArray(promises) ? promises : []

    let fulfilledCount = 0 // 状态变完成的个数
    let promisesLength = promises.length // 需要完成的个数
    let results = new Array(promisesLength) // 设置结果数组长度

    return new Promise((resolve, reject) => {
      // 如果是个空数组，那么将直接变为完成状态，并传入空数组参数值
      if (promisesLength === 0) return resolve([])
      // 遍历数组中的promise
      promises.forEach((promise, index) => {
        // 判断是不是一个promise
        if (isObject(promise) && isFunction(promise.then)) {
          promise.then(
            (value) => {
              // 向结果数组中存入 对应返回数据值
              results[index] = value
              // 当等于了需完成的个数，说明已全部都处理完了，那么就直接将状态变为完成，返回最终数据
              if (++fulfilledCount === promisesLength) resolve(results)
            },
            (err) => reject(err) // 只要一个发生错误，那么直接变为失败，并返回失败原因
          )
        } else {
          // 如果不是一个promise，将直接存值
          results[index] = promise
          if (++fulfilledCount === promisesLength) resolve(results)
        }
      })
    })
  }

  // 看谁快
  static race(promises) {
    promises = isArray(promises) ? promises.filter(item => isObject(item) && isFunction(item.then)) : []

    return new Promise((resolve, reject) => {
      promises.forEach((promise) => {
        promise.then(
          (value) => resolve(value),
          (err) => reject(err)
        )
      })
    })
  }
}

// 延迟执行，这个主要用于promise A+规范跑测使用
Promise.defer = Promise.deferred = () => {
  let dfd = {}
  dfd.promise = new Promise((resolve, reject) => {
    dfd.resolve = resolve
    dfd.reject = reject
  })
  return dfd
}

module.exports = Promise
