import { useEffect, useRef, useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getCachedToys } from '../utils/toyCache'
import './ClawMachine.css'

const CORNER_BUFFER = 16
const MACHINE_BUFFER = { x: 36, y: 16 }

const randomN = (min, max) => Math.round(min - 0.5 + Math.random() * (max - min + 1))
const radToDeg = (rad) => Math.round(rad * (180 / Math.PI))
const calcX = (i, n) => i % n
const calcY = (i, n) => Math.floor(i / n)
const adjustAngle = (angle) => {
  const a = angle % 360
  return a < 0 ? a + 360 : a
}

export default function ClawMachine({ playable = true, onTurnEnd, onDrop, onSuccess, userId, active = true, seed, slipRate = 0.4 }) {
  const boxRef = useRef(null)
  const machineRef = useRef(null)
  const machineTopRef = useRef(null)
  const machineBottomRef = useRef(null)
  const armJointRef = useRef(null)
  const armRef = useRef(null)
  const vertRailRef = useRef(null)
  const horiBtnRef = useRef(null)
  const vertBtnRef = useRef(null)
  const collectionBoxRef = useRef(null)
  const collectionArrowRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const keyActiveRef = useRef({ ArrowRight: false, ArrowUp: false })
  const playableRef = useRef(playable)

  useEffect(() => {
    playableRef.current = playable
    if (playable && horiBtnRef.current && gameRef.current.objects.armJoint) {
      activateHoriBtn()
    }
  }, [playable]) // eslint-disable-line react-hooks/exhaustive-deps

  // mutable game state stored in refs so we don't re-render on every frame
  const gameRef = useRef({
    toys: {},
    sortedToys: [],
    toyEls: [],
    targetToy: null,
    collectedNumber: 0,
    maxArmLength: 0,
    machineWidth: 0,
    machineHeight: 0,
    machineTop: 0,
    machineTopHeight: 0,
    machineBottomHeight: 0,
    machineBottomTop: 0,
    objects: {},
    intervals: new Set(),
  })

  // ---- WorldObject-like helpers (imperative, no React state) ----

  const createWorldObject = useCallback((el, props = {}) => {
    const obj = {
      el,
      x: 0, y: 0, z: 0, w: 0, h: 0,
      angle: 0,
      transformOrigin: { x: 0, y: 0 },
      interval: null,
      default: {},
      moveWith: [],
      bottom: null,
      ...props,
    }
    applyStyles(obj)
    if (el) {
      const rect = el.getBoundingClientRect()
      obj.w = rect.width
      obj.h = rect.height
    }
    obj.default = { x: obj.x, y: obj.y, w: obj.w, h: obj.h }
    return obj
  }, [])

  const applyStyles = (obj) => {
    if (!obj.el) return
    obj.el.style.left = `${obj.x}px`
    if (!obj.bottom) obj.el.style.top = `${obj.y}px`
    if (obj.bottom) obj.el.style.bottom = obj.bottom
    obj.el.style.width = `${obj.w}px`
    obj.el.style.height = `${obj.h}px`
    obj.el.style.zIndex = obj.z
    if (typeof obj.transformOrigin === 'string') {
      obj.el.style.transformOrigin = obj.transformOrigin
    } else {
      obj.el.style.transformOrigin = `${obj.transformOrigin.x}px ${obj.transformOrigin.y}px`
    }
  }

  const resizeShadow = (obj) => {
    const g = gameRef.current
    if (boxRef.current) {
      boxRef.current.style.setProperty('--scale', 0.5 + obj.h / g.maxArmLength / 2)
    }
  }

  const clearObjInterval = (obj) => {
    if (obj.interval) {
      clearInterval(obj.interval)
      gameRef.current.intervals.delete(obj.interval)
      obj.interval = null
    }
  }

  const moveObject = (obj, { moveKey, target, moveTime, next }) => {
    if (obj.interval) {
      clearObjInterval(obj)
      if (next) next()
    } else {
      const moveTarget = target ?? obj.default[moveKey]
      const id = setInterval(() => {
        const distance = Math.abs(obj[moveKey] - moveTarget) < 10
          ? Math.abs(obj[moveKey] - moveTarget)
          : 10
        const increment = obj[moveKey] > moveTarget ? -distance : distance
        const shouldMove = increment > 0 ? obj[moveKey] < moveTarget : obj[moveKey] > moveTarget
        if (shouldMove) {
          obj[moveKey] += increment
          applyStyles(obj)
          if (moveKey === 'h') resizeShadow(obj)
          obj.moveWith.forEach((m) => {
            if (!m) return
            m[moveKey === 'h' ? 'y' : moveKey] += increment
            applyStyles(m)
          })
        } else {
          clearObjInterval(obj)
          if (next) next()
        }
      }, moveTime || 100)
      obj.interval = id
      gameRef.current.intervals.add(id)
    }
  }

  const resumeMove = (obj, opts) => {
    obj.interval = null
    moveObject(obj, opts)
  }

  // ---- Toy helpers ----

  const createToy = (index) => {
    const g = gameRef.current
    const toyType = g.sortedToys[index]
    const size = g.toys[toyType]
    if (!size) return null

    const el = document.createElement('div')
    el.className = `toy pix ${toyType}`

    const x = 4 + calcX(index, 4) * ((g.machineWidth - CORNER_BUFFER * 2) / 4) + size.w / 2 + randomN(-3, 3)
    const y = g.machineBottomTop - g.machineTop + CORNER_BUFFER + calcY(index, 4) * ((g.machineBottomHeight - CORNER_BUFFER * 2) / 3) - size.h / 2 + randomN(-2, 2)

    el.style.setProperty('--sw', `${size.sw}px`)
    el.style.setProperty('--sh', `${size.sh}px`)
    el.style.setProperty('--st', `${size.st}px`)
    el.style.setProperty('--sl', `${size.sl}px`)
    el.style.setProperty('--s-normal', `url(${size.sNormal})`)
    el.style.setProperty('--s-grabbed', `url(${size.sGrabbed || size.sNormal})`)
    el.style.setProperty('--s-collected', `url(${size.sCollected || size.sNormal})`)

    // Preload grabbed sprite to prevent glitch when toy is grabbed
    if (size.sGrabbed && size.sGrabbed !== size.sNormal) {
      const preloadImg = new Image()
      preloadImg.src = size.sGrabbed
    }

    boxRef.current.append(el)

    const toy = {
      el, x, y, z: 0, w: size.w, h: size.h,
      toyType, index,
      angle: 0,
      transformOrigin: { x: 0, y: 0 },
      interval: null,
      default: {},
      moveWith: [],
      clawPos: null,
    }
    toy.default = { x, y, w: size.w, h: size.h }
    applyStyles(toy)

    el.addEventListener('click', () => collectToy(toy))
    g.toyEls.push(toy)
    return toy
  }

  const collectToy = (toy) => {
    const g = gameRef.current
    toy.el.classList.remove('selected')
    toy.x = g.machineWidth / 2 - toy.w / 2
    toy.y = g.machineHeight / 2 - toy.h / 2
    toy.z = 7
    toy.el.style.setProperty('--rotate-angle', '0deg')
    toy.transformOrigin = 'center'
    applyStyles(toy)
    toy.el.classList.add('display')
    g.collectedNumber++

    // First, try to get existing count
    supabase
      .from('user_toys')
      .select('count')
      .eq('user_id', userId || 'anonymous')
      .eq('toy_id', toy.toyType)
      .single()
      .then(({ data }) => {
        const newCount = data ? data.count + 1 : 1
        return supabase
          .from('user_toys')
          .upsert(
            { user_id: userId || 'anonymous', toy_id: toy.toyType, count: newCount },
            { onConflict: 'user_id,toy_id' }
          )
      })
      .then(() => {
        if (window.parent) {
          window.parent.postMessage({ type: 'TOY_COLLECTED', toyId: toy.toyType }, '*')
        }
      })
      .catch((err) => console.error('Error saving toy:', err))

    const toyData = g.toys[toy.toyType]
    const wrapper = document.createElement('div')
    wrapper.className = `toy-wrapper ${g.collectedNumber > 6 ? 'squeeze-in' : ''}`
    wrapper.innerHTML = `<div class="toy pix ${toy.toyType}"></div>`
    const collectedToyEl = wrapper.querySelector('.toy')
    collectedToyEl.style.setProperty('--sw', `${toyData.sw}px`)
    collectedToyEl.style.setProperty('--sh', `${toyData.sh}px`)
    collectedToyEl.style.setProperty('--st', `${toyData.st}px`)
    collectedToyEl.style.setProperty('--sl', `${toyData.sl}px`)
    collectedToyEl.style.setProperty('--s-normal', `url(${toyData.sNormal})`)
    collectedToyEl.style.setProperty('--s-grabbed', `url(${toyData.sGrabbed || toyData.sNormal})`)
    collectedToyEl.style.setProperty('--s-collected', `url(${toyData.sCollected || toyData.sNormal})`)

    collectionBoxRef.current.appendChild(wrapper)
    setTimeout(() => {
      if (!document.querySelector('.selected')) {
        collectionArrowRef.current?.classList.remove('active')
      }
    }, 1000)
  }

  const setRotateAngle = (toy) => {
    const angle = radToDeg(Math.atan2(
      toy.y + toy.h / 2 - toy.clawPos.y,
      toy.x + toy.w / 2 - toy.clawPos.x,
    )) - 90
    const adjusted = Math.round(adjustAngle(angle))
    toy.angle = adjusted < 180 ? adjusted * -1 : 360 - adjusted
    toy.el.style.setProperty('--rotate-angle', `${toy.angle}deg`)
  }

  // ---- Game logic ----

  const doOverlap = (a, b) => b.x > a.x && b.x < a.x + a.w && b.y > a.y && b.y < a.y + a.h

  const getClosestToy = () => {
    const g = gameRef.current
    const { armJoint } = g.objects
    const claw = {
      y: armJoint.y + g.maxArmLength + MACHINE_BUFFER.y + 7,
      x: armJoint.x + 7,
      w: 40,
      h: 32,
    }
    const overlapped = g.toyEls.filter((t) => doOverlap(t, claw))
    if (overlapped.length) {
      const toy = overlapped.sort((a, b) => b.index - a.index)[0]
      toy.transformOrigin = { x: claw.x - toy.x, y: claw.y - toy.y }
      applyStyles(toy)
      toy.clawPos = { x: claw.x, y: claw.y }
      g.targetToy = toy
    }
  }

  const activateBtn = (btnEl) => {
    btnEl.classList.add('active')
    btnEl.dataset.locked = 'false'
  }
  const deactivateBtn = (btnEl) => {
    btnEl.classList.remove('active')
    btnEl.dataset.locked = 'true'
  }

  const activateHoriBtn = () => {
    if (!playableRef.current) return
    const g = gameRef.current
    activateBtn(horiBtnRef.current)
    const { vertRail, armJoint, arm } = g.objects
    ;[vertRail, armJoint, arm].forEach((c) => clearObjInterval(c))
  }

  const stopHoriBtnAndActivateVertBtn = () => {
    const g = gameRef.current
    g.objects.armJoint.interval = null
    deactivateBtn(horiBtnRef.current)
    activateBtn(vertBtnRef.current)
  }

  const dropToy = () => {
    const g = gameRef.current
    const { arm, vertRail, armJoint } = g.objects
    arm.el.classList.add('open')
    if (g.targetToy) {
      g.targetToy.z = 3
      moveObject(g.targetToy, {
        moveKey: 'y',
        target: g.machineHeight - g.targetToy.h - 30,
        moveTime: 50,
      })
      ;[vertRail, armJoint, arm].forEach((obj) => (obj.moveWith[0] = null))
      // Call success callback - toy made it to the chute!
      onSuccess?.()
    }
    setTimeout(() => {
      arm.el.classList.remove('open')
      if (g.targetToy) {
        g.targetToy.el.classList.add('selected')
        collectionArrowRef.current?.classList.add('active')
        g.targetToy = null
      }
    }, 700)
  }

  const grabToy = () => {
    const g = gameRef.current
    const { vertRail, armJoint, arm } = g.objects
    if (g.targetToy) {
      ;[vertRail, armJoint, arm].forEach((obj) => (obj.moveWith[0] = g.targetToy))
      setRotateAngle(g.targetToy)
      g.targetToy.el.classList.add('grabbed')

      // Schedule potential drop check - 30% chance but only if shadow not over chute
      const randomDelay = Math.random() * 4000
      setTimeout(() => {
        if (g.targetToy) {
          // Chute opening (bottom-left corner)
          // Width: 44px * m, Height: 24px * m
          const m = 2.3 // multiplier from CSS
          const chuteMinX = 0
          const chuteMaxX = 44 * m // ~101px
          const chuteMinY = g.machineHeight - 24 * m // top of chute
          const chuteMaxY = g.machineHeight // bottom of chute

          // Shadow position (with -15px X offset from CSS margin-left)
          const shadowX = armJoint.x - 15
          const shadowY = armJoint.y + g.maxArmLength // shadow follows arm Y + maxArmLength

          // Check if shadow is over the chute (both X and Y must be in range)
          const isOverChuteX = shadowX >= chuteMinX && shadowX <= chuteMaxX
          const isOverChuteY = shadowY >= chuteMinY && shadowY <= chuteMaxY
          const isOverChute = isOverChuteX && isOverChuteY

          // Only drop if shadow is NOT over the chute
          if (!isOverChute) {
            // Use dynamic slip rate (default 0.4, reduced by milestones, min 0.1)
            if (Math.random() <= slipRate) {
              dropToyToOriginal()
            }
          }
        }
      }, randomDelay)
    } else {
      arm.el.classList.add('missed')
    }
  }

  const dropToyToOriginal = () => {
    const g = gameRef.current
    const { vertRail, armJoint, arm } = g.objects
    if (g.targetToy) {
      const toy = g.targetToy
      // Detach toy from arm
      ;[vertRail, armJoint, arm].forEach((obj) => (obj.moveWith[0] = null))
      toy.el.classList.remove('grabbed')
      toy.el.style.setProperty('--rotate-angle', '0deg')
      toy.transformOrigin = 'center'
      applyStyles(toy)

      // Call onDrop callback for toast
      onDrop?.()

      // Animate toy falling to original y but keep current x
      const startY = toy.y
      const targetY = toy.default.y
      const duration = 300
      const startTime = Date.now()

      const animateDrop = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)
        // Ease out for natural fall
        const eased = 1 - Math.pow(1 - progress, 2)

        toy.y = startY + (targetY - startY) * eased
        applyStyles(toy)

        if (progress < 1) {
          requestAnimationFrame(animateDrop)
        } else {
          // Update default x to current position so it stays there
          toy.default.x = toy.x
        }
      }
      requestAnimationFrame(animateDrop)

      g.targetToy = null
    }
  }

  // ---- Button handlers ----

  const onHoriBtnDown = () => {
    const g = gameRef.current
    const { vertRail, arm } = g.objects
    arm.el.classList.remove('missed')
    moveObject(vertRail, {
      moveKey: 'x',
      target: g.machineWidth - g.objects.armJoint.w - MACHINE_BUFFER.x,
      moveTime: 30,
      next: stopHoriBtnAndActivateVertBtn,
    })
  }

  const onHoriBtnUp = () => {
    const g = gameRef.current
    clearObjInterval(g.objects.vertRail)
    stopHoriBtnAndActivateVertBtn()
  }

  const onVertBtnDown = () => {
    if (vertBtnRef.current?.dataset.locked === 'true') return
    const g = gameRef.current
    moveObject(g.objects.armJoint, {
      moveKey: 'y',
      target: MACHINE_BUFFER.y,
      moveTime: 30,
    })
  }

  const onVertBtnUp = () => {
    const g = gameRef.current
    const { armJoint, arm, vertRail } = g.objects
    clearObjInterval(armJoint)
    deactivateBtn(vertBtnRef.current)
    getClosestToy()
    setTimeout(() => {
      arm.el.classList.add('open')
      moveObject(arm, {
        moveKey: 'h',
        target: g.maxArmLength,
        next: () =>
          setTimeout(() => {
            arm.el.classList.remove('open')
            grabToy()
            resumeMove(arm, {
              moveKey: 'h',
              next: () => {
                resumeMove(vertRail, {
                  moveKey: 'x',
                  next: () => {
                    resumeMove(armJoint, {
                      moveKey: 'y',
                      next: () => {
                        dropToy()
                        // Call onTurnEnd after entire sequence completes
                        setTimeout(() => {
                          onTurnEnd?.()
                        }, 1000)
                      },
                    })
                  },
                })
              },
            })
          }, 500),
      })
    }, 500)
  }

  // ---- Fetch toys ----

  const fetchToys = async () => {
    const g = gameRef.current
    try {
      const toys = await getCachedToys()
      if (!toys) return
      g.toys = toys
      const ogKeys = Object.keys(g.toys).filter((k) => g.toys[k].group === 'og')
      const otherKeys = Object.keys(g.toys).filter((k) => g.toys[k].group !== 'og')
      
      // Use seeded random if seed provided, otherwise use Math.random
      let seededRand = Math.random
      if (seed) {
        let state = 0
        for (let i = 0; i < seed.length; i++) {
          state = ((state << 5) - state) + seed.charCodeAt(i)
          state = state & state
        }
        state = Math.abs(state)
        seededRand = () => {
          state = (state * 1664525 + 1013904223) | 0
          return Math.abs(state) / 0x100000000
        }
      }
      
      // 25% chance og, 75% chance other
      g.sortedToys = new Array(12).fill('').map(() => {
        if (seededRand() < 0.25 && ogKeys.length) {
          const idx = Math.floor(seededRand() * ogKeys.length)
          return ogKeys[idx]
        }
        const idx = Math.floor(seededRand() * otherKeys.length)
        return otherKeys[idx]
      })
    } catch (err) {
      console.error('Error fetching toys:', err)
    }
  }

  // ---- Re-distribute toys when seed changes ----

  useEffect(() => {
    const g = gameRef.current
    if (!g.initialized || !g.toys) return

    // Re-run distribution with new seed
    const ogKeys = Object.keys(g.toys).filter((k) => g.toys[k].group === 'og')
    const otherKeys = Object.keys(g.toys).filter((k) => g.toys[k].group !== 'og')

    let seededRand = Math.random
    if (seed) {
      let state = 0
      for (let i = 0; i < seed.length; i++) {
        state = ((state << 5) - state) + seed.charCodeAt(i)
        state = state & state
      }
      state = Math.abs(state)
      seededRand = () => {
        state = (state * 1664525 + 1013904223) | 0
        return Math.abs(state) / 0x100000000
      }
    }

    // 25% chance og, 75% chance other
    g.sortedToys = new Array(12).fill('').map(() => {
      if (seededRand() < 0.25 && ogKeys.length) {
        const idx = Math.floor(seededRand() * ogKeys.length)
        return ogKeys[idx]
      }
      const idx = Math.floor(seededRand() * otherKeys.length)
      return otherKeys[idx]
    })

    // Remove old toy elements
    g.toyEls.forEach((toy) => toy.el.remove())
    g.toyEls = []
    g.collectedNumber = 0
    g.targetToy = null

    // Recreate toys
    new Array(12).fill('').forEach((_, i) => {
      if (i === 8) return
      createToy(i)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed])

  // ---- Init when active (visible) ----

  useEffect(() => {
    const g = gameRef.current
    if (!active || g.initialized) return
    // Wait a frame so the browser has laid out the now-visible element
    const rafId = requestAnimationFrame(() => {
      if (g.initialized) return
      g.initialized = true

      // measure DOM
      const machineRect = machineRef.current.getBoundingClientRect()
      g.machineWidth = machineRect.width
      g.machineHeight = machineRect.height
      g.machineTop = machineRect.top

      const mtRect = machineTopRef.current.getBoundingClientRect()
      g.machineTopHeight = mtRect.height

      const mbRect = machineBottomRef.current.getBoundingClientRect()
      g.machineBottomHeight = mbRect.height
      g.machineBottomTop = mbRect.top

      g.maxArmLength = g.machineBottomTop - g.machineTop - MACHINE_BUFFER.y
      boxRef.current.style.setProperty('--shadow-pos', `${g.maxArmLength}px`)

      // create world objects
      const armJoint = createWorldObject(armJointRef.current)
      const vertRail = createWorldObject(vertRailRef.current)
      const arm = createWorldObject(armRef.current)

      vertRail.moveWith = [null, armJoint]
      g.objects = { armJoint, vertRail, arm }

      resizeShadow(armJoint)

      // initial animation: move arm into position
      moveObject(armJoint, {
        moveKey: 'y',
        target: g.machineTopHeight - MACHINE_BUFFER.y,
        moveTime: 50,
        next: () =>
          resumeMove(vertRail, {
            moveKey: 'x',
            target: MACHINE_BUFFER.x,
            moveTime: 50,
            next: () => {
              Object.assign(armJoint.default, { y: g.machineTopHeight - MACHINE_BUFFER.y, x: MACHINE_BUFFER.x })
              Object.assign(vertRail.default, { x: MACHINE_BUFFER.x })
              if (playableRef.current) activateHoriBtn()
            },
          }),
      })

      // fetch toys and create them
      fetchToys().then(() => {
        new Array(12).fill('').forEach((_, i) => {
          if (i === 8) return
          createToy(i)
        })
        setLoading(false)
      })
    })

    return () => {
      cancelAnimationFrame(rafId)
      g.intervals.forEach((id) => clearInterval(id))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  // ---- Keyboard controls ----

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') {
        if (keyActiveRef.current.ArrowRight) return // prevent key-repeat
        if (horiBtnRef.current?.dataset.locked === 'true') return
        keyActiveRef.current.ArrowRight = true
        onHoriBtnDown()
      } else if (e.key === 'ArrowUp') {
        if (keyActiveRef.current.ArrowUp) return
        if (vertBtnRef.current?.dataset.locked === 'true') return
        keyActiveRef.current.ArrowUp = true
        onVertBtnDown()
      }
    }

    const handleKeyUp = (e) => {
      if (e.key === 'ArrowRight') {
        if (!keyActiveRef.current.ArrowRight) return
        keyActiveRef.current.ArrowRight = false
        if (horiBtnRef.current?.dataset.locked === 'true') return
        onHoriBtnUp()
      } else if (e.key === 'ArrowUp') {
        if (!keyActiveRef.current.ArrowUp) return
        keyActiveRef.current.ArrowUp = false
        if (vertBtnRef.current?.dataset.locked === 'true') return
        onVertBtnUp()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Render ----

  return (
    <div className="wrapper">
      <div className="collection-box pix" ref={collectionBoxRef}></div>
      <div className="claw-machine" ref={machineRef}>
        <div className="box pix" ref={boxRef}>
          <div className="smiley">{'\u{1F608}'}</div>
          <div className="bandaid"></div>
          <div className="bandaid bandaid-x"></div>
          <div className="machine-top pix" ref={machineTopRef}>
            <div className="arm-joint pix" ref={armJointRef}>
              <div className="arm pix" ref={armRef}>
                <div className="claws pix"></div>
              </div>
            </div>
            <div className="rail hori pix"></div>
            <div className="rail vert pix" ref={vertRailRef}></div>
          </div>
          <div className="machine-bottom pix" ref={machineBottomRef}>
            <div className="drop-zone"></div>
            {loading && (
              <div className="loading-bubble">
                <span className="loading-dots"></span>
                <span>Loading toys</span>
              </div>
            )}
          </div>
        </div>
        <div className="control pix">
          <div className="cover left"></div>
          <button
            className="hori-btn pix"
            ref={horiBtnRef}
            data-locked="true"
            onMouseDown={onHoriBtnDown}
            onTouchStart={(e) => { e.preventDefault(); onHoriBtnDown(); }}
            onMouseUp={onHoriBtnUp}
            onTouchEnd={onHoriBtnUp}
            onContextMenu={(e) => e.preventDefault()}
          ></button>
          <button
            className="vert-btn pix"
            ref={vertBtnRef}
            data-locked="true"
            onMouseDown={onVertBtnDown}
            onTouchStart={(e) => { e.preventDefault(); onVertBtnDown(); }}
            onMouseUp={onVertBtnUp}
            onTouchEnd={onVertBtnUp}
            onContextMenu={(e) => e.preventDefault()}
          ></button>
          <div className="cover right">
            <div className="instruction pix"></div>
          </div>
          <div className="cover bottom"></div>
          <div className="cover top">
            <div className="collection-arrow pix" ref={collectionArrowRef}></div>
          </div>
          <div className="loot-tag">"LoOT"</div>
          <div className="loot-arrow">{'\u2193'}</div>
          <div className="collection-point pix"></div>
        </div>
      </div>
    </div>
  )
}
