interface Pubs extends Array<{ a: /* act */ () => any; s: /* state */ any }> {}

interface Effect {
  (): void
  _v: /* leafs */ Array<ActValue>
}

interface Subscribable<T> {
  subscribe(cb: (state: T) => any): () => void
}

export interface ActValue<T = any> extends Subscribable<T> {
  (state?: T): T
  _e: /* roots */ Array<Effect>
}
export interface ActComputed<T = any> extends Subscribable<T> {
  (): T
}

let root: null | Effect = null
let pubs: null | Pubs = null
// global `dirty` flag used to cache visited nodes during invalidation
let version = 0
let queue: Array<Array<() => any>> = []

// @ts-expect-error
export let act: {
  <T>(computed: () => T, equal?: (prev: T, next: T) => boolean): ActComputed<T>
  <T>(state: T): ActValue<T>

  notify: (cb: () => void) => void
} = (s, equal?: (prev: any, next: any) => boolean): any => {
  let _version = -1
  let a: ActValue<any> & ActComputed<any>

  if (typeof s === 'function') {
    let _pubs: Pubs = []
    let computed = s as () => any
    // @ts-expect-error
    a = () => {
      if (!root || _version !== version) {
        let prevPubs = pubs
        pubs = null
        if (_pubs.length === 0 || _pubs.some((el) => el.a() !== el.s)) {
          pubs = _pubs = []
          let newState = computed()
          if (_version === -1 || !equal?.(s, newState)) s = newState
        }
        pubs = prevPubs

        _version = version
      }

      pubs?.push({ a, s })

      return s
    }
  } else {
    // @ts-expect-error
    a = (...args: any[]) => {
      if (args.length && args[0] !== s) {
        s = args[0]
        queue.push(a._e)
        a._e = []

        act.notify(() => {
          const _queue = queue
          queue = []
          for (let effects of _queue) for (let effect of effects) effect()
        })
      }

      pubs?.push({ a, s })

      if (root && _version !== version) {
        _version = version
        a._e.push(root)
        root._v.push(a)
      }

      return s
    }
    a._e = []
  }

  a.subscribe = (cb) => {
    let lastQueu: any
    let lastState: any = {}
    // @ts-expect-error
    let effect: Effect = () => {
      if (lastQueu === queue) return
      lastQueu = queue

      ++version

      let prevRoot = root
      root = effect

      effect._v = []
      if (lastState !== a()) cb((lastState = s))
      root = prevRoot
    }
    effect()
    lastQueu = null

    return () => {
      for (let a of effect._v) a._e.splice(a._e.indexOf(effect), 1)
    }
  }

  return a
}
act.notify = (cb) => Promise.resolve().then(cb)
