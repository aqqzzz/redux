import $$observable from 'symbol-observable'

import ActionTypes from './utils/actionTypes'
import isPlainObject from './utils/isPlainObject'

/**
 * Creates a Redux store that holds the state tree.
 * The only way to change the data in the store is to call `dispatch()` on it.
 *
 * There should only be a single store in your app. To specify how different
 * parts of the state tree respond to actions, you may combine several reducers
 * into a single reducer function by using `combineReducers`.
 *
 * @param {Function} [reducer] A function that returns the next state tree, given
 * the current state tree and the action to handle.
 *
 * @param {any} [preloadedState] The initial state. You may optionally specify it
 * to hydrate the state from the server in universal apps, or to restore a
 * previously serialized user session.
 * If you use `combineReducers` to produce the root reducer function, this must be
 * an object with the same shape as `combineReducers` keys.
 *
 * @param {Function} [enhancer] The store enhancer. You may optionally specify it
 * to enhance the store with third-party capabilities such as middleware,
 * time travel, persistence, etc. The only store enhancer that ships with Redux
 * is `applyMiddleware()`.
 *
 * @returns {Store} A Redux store that lets you read the state, dispatch actions
 * and subscribe to changes.
 */
export default function createStore(reducer, preloadedState, enhancer) {
  if (
    (typeof preloadedState === 'function' && typeof enhancer === 'function') ||
    (typeof enhancer === 'function' && typeof arguments[3] === 'function')
  ) {
    throw new Error(
      'It looks like you are passing several store enhancers to ' +
        'createStore(). This is not supported. Instead, compose them ' +
        'together to a single function.'
    )
  }

  if (typeof preloadedState === 'function' && typeof enhancer === 'undefined') {
    enhancer = preloadedState
    preloadedState = undefined
  }

  if (typeof enhancer !== 'undefined') {
    if (typeof enhancer !== 'function') {
      throw new Error('Expected the enhancer to be a function.')
    }

    return enhancer(createStore)(reducer, preloadedState)
  }

  if (typeof reducer !== 'function') {
    throw new Error('Expected the reducer to be a function.')
  }

  let currentReducer = reducer
  let currentState = preloadedState
  let currentListeners = []
  let nextListeners = currentListeners
  let isDispatching = false // 当前是否处于一次dispatch过程中

  /**
   * This makes a shallow copy of currentListeners so we can use
   * nextListeners as a temporary list while dispatching.
   *
   * This prevents any bugs around consumers calling
   * subscribe/unsubscribe in the middle of a dispatch.
   * listenrs 浅复制，是一个防止 在某次dispatch过程中添加新的 观察者 的方法
   * 只有在 listener副本 和 真实listener 指向同一个内存地址的数组时才会执行copy方法
   */
  function ensureCanMutateNextListeners() {
    if (nextListeners === currentListeners) {
      nextListeners = currentListeners.slice()
    }
  }

  /**
   * Reads the state tree managed by the store.
   *
   * @returns {any} The current state tree of your application.
   * 获取当前store 的值
   * 【注】如果正处于一次 dispatch 的过程中的话，是不能获取state 的
   */
  function getState() {
    if (isDispatching) {
      throw new Error(
        'You may not call store.getState() while the reducer is executing. ' +
          'The reducer has already received the state as an argument. ' +
          'Pass it down from the top reducer instead of reading it from the store.'
      )
    }

    return currentState
  }

  /**
   * Adds a change listener. It will be called any time an action is dispatched,
   * and some part of the state tree may potentially have changed. You may then
   * call `getState()` to read the current state tree inside the callback.
   *
   * You may call `dispatch()` from a change listener, with the following
   * caveats: // 当我们调用 listener 监听数组中的dispatch 方法时，可能会有如下警告
   *
   * 1. The subscriptions are snapshotted just before every `dispatch()` call.
   * If you subscribe or unsubscribe while the listeners are being invoked, this
   * will not have any effect on the `dispatch()` that is currently in progress.
   * However, the next `dispatch()` call, whether nested or not, will use a more
   * recent snapshot of the subscription list.
   * // 在每次 dispatch 方法调用之前，注册的观察者都会保存一个副本，如果我们在 观察者被调用的过程中（也就是isDispatching 为 true 的时候）
   * 又注册或者注销了一个观察者，这个操作不会对 当次 dispatch 方法有任何影响，因为这次调用的listeners是副本中的，也就是nextListeners
   * 但是下次调用dispatch方法时，会重新执行这个过程，当然也会调用nextListeners，但是会在进入subscribe 的时候先把currentListeners复制过去
   * 此时的currentListeners应该已经把 我们注册 或 注销的观察者加进去了
   *
   * 2. The listener should not expect to see all state changes, as the state
   * might have been updated multiple times during a nested `dispatch()` before
   * the listener is called. It is, however, guaranteed that all subscribers
   * registered before the `dispatch()` started will be called with the latest
   * state by the time it exits.
   *
   * @param {Function} listener A callback to be invoked on every dispatch.
   * @returns {Function} A function to remove this change listener.
   */
  function subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new Error('Expected the listener to be a function.')
    }

    if (isDispatching) {
      throw new Error(
        'You may not call store.subscribe() while the reducer is executing. ' +
          'If you would like to be notified after the store has been updated, subscribe from a ' +
          'component and invoke store.getState() in the callback to access the latest state. ' +
          'See https://redux.js.org/api-reference/store#subscribe(listener) for more details.'
      )
    }

    let isSubscribed = true // 标志位，标识当前listener被注册为一个观察者了

    ensureCanMutateNextListeners()  // 将currentListeners 浅复制到 nextListeners（保存了一个观察者副本）
    nextListeners.push(listener) // 将当前 listener 注册到 观察者副本中去

    return function unsubscribe() { // return 一个取消注册的方法
      if (!isSubscribed) { // 如果当前 listener 已经不是一个观察者了（可能会有多次解绑的情况），直接return
        return
      }

      if (isDispatching) { // 如果当前正好处于一次 dispatch 的过程，是不允许解绑的
        throw new Error(
          'You may not unsubscribe from a store listener while the reducer is executing. ' +
            'See https://redux.js.org/api-reference/store#subscribe(listener) for more details.'
        )
      }

      isSubscribed = false // 标志当前 listener 已经被解绑

      ensureCanMutateNextListeners() // 真正解绑之前 复制一份解绑前的 listeners 副本
      const index = nextListeners.indexOf(listener)
      nextListeners.splice(index, 1) // 在副本中删除当前 listener
    }
  }

  /**
   * Dispatches an action. It is the only way to trigger a state change.
   * // dispatch 是触发改变 store 的唯一方法
   *
   * The `reducer` function, used to create the store, will be called with the
   * current state tree and the given `action`. Its return value will
   * be considered the **next** state of the tree, and the change listeners
   * will be notified.
   * // reducer 定义了根据 旧的store树和具体action，返回新的store 树的逻辑
   * 同时会触发所有的观察者
   *
   * The base implementation only supports plain object actions. If you want to
   * dispatch a Promise, an Observable, a thunk, or something else, you need to
   * wrap your store creating function into the corresponding middleware. For
   * example, see the documentation for the `redux-thunk` package. Even the
   * middleware will eventually dispatch plain object actions using this method.
   * // 基本方法只支持 dispatch 一个对象，
   * 对于 Promise、Observable、thunk函数或者其他对象，需要使用 middleware 处理
   *
   * @param {Object} action A plain object representing “what changed”. It is
   * a good idea to keep actions serializable so you can record and replay user
   * sessions, or use the time travelling `redux-devtools`. An action must have
   * a `type` property which may not be `undefined`. It is a good idea to use
   * string constants for action types.
   * // action 代表改变的部分，对象
   *
   * @returns {Object} For convenience, the same action object you dispatched.
   * // 返回值为 dispatch 的action 对象
   *
   * Note that, if you use a custom middleware, it may wrap `dispatch()` to
   * return something else (for example, a Promise you can await).
   * // 自定义中间件 需要包装 dispatch 方法来返回一些其他的东西
   */
  function dispatch(action) {
    if (!isPlainObject(action)) {
      throw new Error(
        'Actions must be plain objects. ' +
          'Use custom middleware for async actions.'
      )
    }

    if (typeof action.type === 'undefined') {
      throw new Error(
        'Actions may not have an undefined "type" property. ' +
          'Have you misspelled a constant?'
      )
    }

    if (isDispatching) { // 如果正在派发一个 action 的话不能同时派发另一个
      throw new Error('Reducers may not dispatch actions.')
    }

    try {
      isDispatching = true // 将派发状态位设置为 true
      currentState = currentReducer(currentState, action) // 用传入的reducer对store 状态树进行更新
    } finally {
      isDispatching = false // 不管更新是否成功都要把派发状态位 设置为 false
    }

    const listeners = (currentListeners = nextListeners) // 将当前listeners监听数组设置为 操作过的副本listeners数组
    // 在dispatch 的时候才将更新的 listener 数组赋值给当前listener 数组
    for (let i = 0; i < listeners.length; i++) {
      const listener = listeners[i]
      listener() // notify 每个观察者方法
    }

    return action // 返回dispatch 的原 action
  }

  /**
   * Replaces the reducer currently used by the store to calculate the state.
   *
   * You might need this if your app implements code splitting and you want to
   * load some of the reducers dynamically. You might also need this if you
   * implement a hot reloading mechanism for Redux.
   * // 代码分割 或 动态加载reducer 或 redux 热加载机制 时 需要使用这个方法？？？？
   *
   * @param {Function} nextReducer The reducer for the store to use instead.
   * @returns {void}
   */
  function replaceReducer(nextReducer) {
    if (typeof nextReducer !== 'function') {
      throw new Error('Expected the nextReducer to be a function.')
    }

    currentReducer = nextReducer

    // This action has a similiar effect to ActionTypes.INIT.
    // Any reducers that existed in both the new and old rootReducer
    // will receive the previous state. This effectively populates
    // the new state tree with any relevant data from the old one.
    // 用旧的state树的某些数据 和一些其他的数据信息 构建新的state树
    dispatch({ type: ActionTypes.REPLACE })
  }

  /**
   * Interoperability point for observable/reactive libraries. 和 observable/reactive 库交互的
   * @returns {observable} A minimal observable of state changes.
   * For more information, see the observable proposal:
   * https://github.com/tc39/proposal-observable // 没看懂
   */
  function observable() {
    const outerSubscribe = subscribe
    return {
      /**
       * The minimal observable subscription method.
       * @param {Object} observer Any object that can be used as an observer.
       * The observer object should have a `next` method.
       * @returns {subscription} An object with an `unsubscribe` method that can
       * be used to unsubscribe the observable from the store, and prevent further
       * emission of values from the observable.
       */
      subscribe(observer) {
        if (typeof observer !== 'object' || observer === null) {
          throw new TypeError('Expected the observer to be an object.')
        }

        function observeState() {
          if (observer.next) {
            observer.next(getState())
          }
        }

        observeState()
        const unsubscribe = outerSubscribe(observeState)
        return { unsubscribe }
      },

      [$$observable]() {
        return this
      }
    }
  }

  // When a store is created, an "INIT" action is dispatched so that every
  // reducer returns their initial state. This effectively populates
  // the initial state tree.
  dispatch({ type: ActionTypes.INIT })

  return {
    dispatch,
    subscribe,
    getState,
    replaceReducer,
    [$$observable]: observable // [$$observable] 是什么意思
  }
}
