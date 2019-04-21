import compose from './compose'

/**
 * Creates a store enhancer that applies middleware to the dispatch method
 * of the Redux store. This is handy for a variety of tasks, such as expressing
 * asynchronous actions in a concise manner, or logging every action payload.
 *
 * See `redux-thunk` package as an example of the Redux middleware.
 *
 * Because middleware is potentially asynchronous, this should be the first
 * store enhancer in the composition chain.
 *
 * Note that each middleware will be given the `dispatch` and `getState` functions
 * as named arguments.
 *
 * @param {...Function} middlewares The middleware chain to be applied.
 * @returns {Function} A store enhancer applying the middleware.
 */
export default function applyMiddleware(...middlewares) {
  return createStore => (...args) => {
    const store = createStore(...args)
    let dispatch = () => {
      throw new Error(
        'Dispatching while constructing your middleware is not allowed. ' +
          'Other middleware would not be applied to this dispatch.'
      )
    }

    const middlewareAPI = {
      getState: store.getState,
      dispatch: (...args) => dispatch(...args) // 这里为什么要用匿名函数包裹返回 dispatch，而不是直接用我们定义的dispatch
      /**
       * js函数传参是按值传递的，如果我们直接返回 用自定义的dispatch 去调用的话，middleware(API)执行时的dispatch是我们传入dispatch时
       * 那个throw Error 的内存地址，
       * 而我们之后会对这个dispatch进行增强，并重新给它赋值，这时js会在堆内存中分配一块新的内存来存放这个新的dispatch 函数实体，
       * 并把栈中dispatch变量的值修改为这个堆内存地址，
       * 这个时候，当我们对middlerware传入 action进行调用时，它对应的dispatch 是我们更新前的 dispatch 函数实体
       * 匿名函数的作用就是，把这个传递的值变为 这个匿名函数的内存地址，而当它被真正调用的时候再去调用真正的dispatch
       * 其实就是把dispatch 包装了一层，在真正 dispatch action 的时候再去对应这个dispatch 真正的函数体（也就是增强之后的函数实体）
       */
    }
    const chain = middlewares.map(middleware => middleware(middlewareAPI))
    dispatch = compose(...chain)(store.dispatch) // 这里的compose其实就是一系列的增强函数，dispatch是最终触发compose执行的参数
    // f(g(h(store.dispatch))) 相当于 next(g(h(store.dispatch)))
    // 因为我们需要返回一个可以替换原先dispatch 的函数，所以这个返回值其实也应该是一个可以接受 一个action作为参数 的函数
    // 只有在真正传入action 的时候，dispatch 才会被调用

    return {
      ...store,
      dispatch
    }
  }
}
