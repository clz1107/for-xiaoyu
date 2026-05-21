/* ============================================
   主逻辑 — 场景控制、动画、交互
   新手一般不需要修改这个文件
   ============================================ */

; (function () {
  'use strict'

  /* ---------- DOM 引用 ---------- */
  const $ = (id) => document.getElementById(id)
  const scenes = {
    opening: $('scene-opening'),
    note: $('scene-note'),
    story: $('scene-story'),
    choice: $('scene-choice'),
    photo: $('scene-photo'),
    climax: $('scene-climax'),
    ending: $('scene-ending')
  }
  const typewriterEl = $('typewriter')
  const noteText = $('noteText')
  const noteSender = $('noteSender')
  const noteHint = $('noteHint')
  const noteWrapper = $('noteWrapper')
  const note = $('note')
  const storyText = $('storyText')
  const nextBtn = $('nextBtn')
  const choiceQuestion = $('choiceQuestion')
  const choiceGroup = $('choiceGroup')
  const photoFrame = $('photoFrame')
  const photoCaption = $('photoCaption')
  const photoNextBtn = $('photoNextBtn')
  const climaxText = $('climaxText')
  const climaxNextBtn = $('climaxNextBtn')
  const endingText = $('endingText')
  const endingSubtitle = $('endingSubtitle')
  const lulu = $('lulu')
  const luluBubble = $('luluBubble')
  const heartsContainer = $('heartsContainer')
  const rippleContainer = $('rippleContainer')
  const hiddenToast = $('hiddenToast')
  const musicBtn = $('musicBtn')

  /* ---------- 状态 ---------- */
  let currentSceneIndex = 0        // 当前在 scenes 数组中的索引
  let isAnimating = false          // 防止重复点击
  let luluTimeout = null
  let luluVisible = false
  let longPressTimer = null
  let isLongPress = false
  let musicPlaying = false
  let audioContext = null
  let musicGain = null
  let musicSource = null
  let musicBuffer = null

  /* ---------- 工具：延时Promise ---------- */
  const wait = (ms) => new Promise(r => setTimeout(r, ms))

  /* ---------- 切换场景 ---------- */
  function showScene(id) {
    Object.values(scenes).forEach(s => s.classList.remove('active'))
    const el = scenes[id]
    if (el) {
      el.style.display = 'flex'
      el.classList.add('active')
    }
  }

  function hideAllScenes() {
    Object.values(scenes).forEach(s => {
      s.classList.remove('active')
      s.style.display = 'none'
    })
  }

  /* ---------- 打字机效果 ---------- */
  async function typewriter(el, text, speed = 55) {
    el.textContent = ''
    el.style.visibility = 'visible'

    for (let i = 0; i < text.length; i++) {
      const char = text[i]
      const visibleText = text.substring(0, i + 1)
      el.innerHTML = visibleText + '<span class="cursor">|</span>'
      await wait(speed)
    }

    el.innerHTML = text + '<span class="cursor">|</span>'
    await wait(400)
    el.innerHTML = text
  }

  /* ---------- 淡入效果 ---------- */
  function fadeIn(el, delay = 0) {
    el.style.opacity = '0'
    el.style.transform = 'translateY(15px)'
    el.style.transition = 'opacity 0.8s ease, transform 0.8s ease'

    if (delay > 0) {
      el.style.transitionDelay = delay + 'ms'
    }

    requestAnimationFrame(() => {
      el.style.opacity = '1'
      el.style.transform = 'translateY(0)'
    })
  }

  /* ---------- 纸条展开（支持打字机文字 / 纸条照片两种模式） ---------- */
  noteWrapper.addEventListener('click', function () {
    if (isAnimating) return
    if (note.classList.contains('unfolded')) return

    isAnimating = true
    note.classList.add('unfolded')
    noteHint.style.opacity = '0'

    const noteMode = STORY_CONFIG.note.mode || 'typewriter'

    if (noteMode === 'photo') {
      note.classList.add('mode-photo')
      const noteImg = note.querySelector('#noteImage img')
      if (noteImg) {
        noteImg.src = STORY_CONFIG.note.photoSrc
        noteImg.onerror = function () {
          noteImg.alt = '纸条照片加载失败'
          noteImg.style.opacity = '0.3'
        }
      }
      document.getElementById('noteImage').style.display = 'block'

      setTimeout(() => {
        document.getElementById('noteImage').classList.add('visible')

        setTimeout(() => {
          noteHint.textContent = '继续偷看 →'
          noteHint.style.opacity = '0.6'
          noteHint.style.cursor = 'pointer'
          noteHint.addEventListener('click', startStory, { once: true })
          isAnimating = false
        }, 800)
      }, 400)
    } else {
      noteText.textContent = ''
      noteSender.textContent = ''
      note.classList.remove('mode-photo')
      document.getElementById('noteImage').style.display = 'none'
      document.getElementById('noteImage').classList.remove('visible')
      noteText.classList.remove('visible')
      noteSender.classList.remove('visible')

      setTimeout(() => {
        typewriterNote(noteText, STORY_CONFIG.note.text, 40).then(() => {
          noteText.classList.add('visible')

          setTimeout(() => {
            noteSender.textContent = STORY_CONFIG.note.sender
            noteSender.classList.add('visible')

            setTimeout(() => {
              noteHint.textContent = '继续偷看 →'
              noteHint.style.opacity = '0.6'
              noteHint.style.cursor = 'pointer'
              noteHint.addEventListener('click', startStory, { once: true })
              isAnimating = false
            }, 800)
          }, 500)
        })
      }, 400)
    }
  })

  /* 纸条内打字机效果 */
  async function typewriterNote(el, text, speed) {
    el.textContent = ''
    el.style.visibility = 'visible'
    el.style.opacity = '1'

    for (let i = 0; i < text.length; i++) {
      const visibleText = text.substring(0, i + 1)
      el.innerHTML = visibleText + '<span class="cursor">|</span>'
      await wait(speed)
    }

    el.innerHTML = text
  }

  /* ---------- 开始剧情 ---------- */
  async function startStory() {
    showLulu()

    await playScene(currentSceneIndex)
  }

  /* ---------- 播放场景 ---------- */
  async function playScene(index) {
    const scenes = STORY_CONFIG.scenes
    if (index >= scenes.length) return

    const scene = scenes[index]

    switch (scene.type) {
      case 'typewriter':
        await playTypewriterScene(scene, index)
        break
      case 'text':
        await playTextScene(scene, index)
        break
      case 'fade-text':
        await playFadeTextScene(scene, index)
        break
      case 'choice':
        await playChoiceScene(scene, index)
        break
      case 'photo':
        await playPhotoScene(scene, index)
        break
      case 'climax':
        await playClimaxScene(scene, index)
        break
      case 'ending':
        await playEndingScene(scene, index)
        break
    }
  }

  /* ---------- 打字机场景 ---------- */
  async function playTypewriterScene(scene, index) {
    hideAllScenes()
    showScene('opening')

    typewriterEl.style.visibility = 'hidden'
    await wait(600)
    await typewriter(typewriterEl, scene.text, 50)
    await wait(1200)

    // 如果是最后一个打字机场景，自动显示纸条
    const nextScenes = STORY_CONFIG.scenes
    let nextIdx = index + 1
    while (nextIdx < nextScenes.length && nextScenes[nextIdx].type === 'typewriter') {
      nextIdx++
    }

    if (nextIdx >= nextScenes.length || nextScenes[nextIdx].type !== 'typewriter') {
      // transition to note
      hideAllScenes()
      showScene('note')
      noteHint.textContent = '轻触纸条展开'
      noteHint.style.opacity = '0.6'
      noteHint.style.cursor = 'default'
      noteText.classList.remove('visible')
      noteSender.classList.remove('visible')
      note.classList.remove('unfolded')
      noteText.textContent = ''
      noteSender.textContent = ''

      // 出现噜噜
      showLulu()

      await wait(500)
      triggerHearts(6)
      currentSceneIndex = index + 1
      return
    }

    currentSceneIndex = index + 1
    await wait(500)
    await playScene(currentSceneIndex)
  }

  /* ---------- 普通文本场景 ---------- */
  async function playTextScene(scene, index) {
    hideAllScenes()
    showScene('story')

    storyText.textContent = ''
    nextBtn.style.display = 'inline-flex'
    nextBtn.textContent = '继续偷看'

    await wait(400)
    storyText.textContent = scene.text
    fadeIn(storyText.parentElement)

    // 进度指示
    addProgressDots(index)

    currentSceneIndex = index

    // 等待点击
    return new Promise((resolve) => {
      nextBtn.onclick = async () => {
        if (isAnimating) return
        isAnimating = true
        triggerHearts(4)

        // 判断下一个场景的类型
        const nextIdx = index + 1
        const scenes = STORY_CONFIG.scenes

        if (nextIdx < scenes.length) {
          const nextScene = scenes[nextIdx]

          // 如果下一个是淡入文字，连续播放多个淡入文字
          if (nextScene.type === 'fade-text') {
            currentSceneIndex = nextIdx
            isAnimating = false
            await playFadeTextSequence(nextIdx)
            resolve()
            return
          }

          if (nextScene.type === 'photo') {
            hideAllScenes()
            isAnimating = false
            await playPhotoScene(nextScene, nextIdx)
            resolve()
            return
          }
        }

        currentSceneIndex = nextIdx
        isAnimating = false
        await playScene(nextIdx)
        resolve()
      }
    })
  }

  /* ---------- 噜噜气泡场景：自动探头说话 ---------- */
  async function playLuluBubbleScene(scene, index) {
    hideAllScenes()

    forceShowLulu()
    await wait(600)

    const text = scene.text.replace(/^[：:]\s*/, '')
    showLuluBubble(text)
    triggerHearts(6)

    await wait(3500)

    luluBubble.classList.remove('show')
    await wait(500)

    const nextIdx = index + 1
    const scenes = STORY_CONFIG.scenes

    if (nextIdx < scenes.length && scenes[nextIdx].type === 'fade-text' && !scenes[nextIdx].luluBubble) {
      currentSceneIndex = nextIdx
      await playFadeTextSequence(nextIdx)
      return
    }

    currentSceneIndex = nextIdx
    await playScene(nextIdx)
  }

  /* 强制显示噜噜（忽略频率限制） */
  function forceShowLulu() {
    lulu.classList.add('show')
    luluVisible = true
    clearTimeout(luluTimeout)
    luluTimeout = setTimeout(() => {
      hideLulu()
    }, 5000)
  }

  /* ---------- 独立淡入文字场景 ---------- */
  async function playFadeTextScene(scene, index) {
    if (scene.luluBubble) {
      await playLuluBubbleScene(scene, index)
      return
    }

    hideAllScenes()
    showScene('story')

    storyText.textContent = ''
    nextBtn.style.display = 'inline-flex'
    nextBtn.textContent = '继续偷看'

    await wait(400)
    storyText.textContent = scene.text
    fadeIn(storyText.parentElement)

    addProgressDots(index)

    currentSceneIndex = index

    return new Promise((resolve) => {
      nextBtn.onclick = async () => {
        if (isAnimating) return
        isAnimating = true
        triggerHearts(3)

        const nextIdx = index + 1
        const scenes = STORY_CONFIG.scenes

        if (nextIdx < scenes.length && scenes[nextIdx].type === 'fade-text') {
          currentSceneIndex = nextIdx
          await playFadeTextSequence(nextIdx)
          resolve()
          return
        }

        currentSceneIndex = nextIdx
        isAnimating = false
        await playScene(nextIdx)
        resolve()
      }
    })
  }

  /* ---------- 淡入文字序列 ---------- */
  async function playFadeTextSequence(startIdx) {
    const scenes = STORY_CONFIG.scenes
    let idx = startIdx

    while (idx < scenes.length && scenes[idx].type === 'fade-text') {
      const currentScene = scenes[idx]

      if (currentScene.luluBubble) {
        hideAllScenes()
        forceShowLulu()

        const text = currentScene.text.replace(/^[：:]\s*/, '')
        showLuluBubble(text)
        triggerHearts(6)

        await wait(3500)
        luluBubble.classList.remove('show')
        await wait(500)

        idx++
        continue
      }

      hideAllScenes()
      showScene('story')
      storyText.textContent = ''
      nextBtn.style.display = 'inline-flex'
      nextBtn.textContent = '继续偷看'

      await wait(400)
      storyText.textContent = scenes[idx].text
      fadeIn(storyText.parentElement)

      addProgressDots(idx)

      await new Promise((resolve) => {
        nextBtn.onclick = () => {
          if (isAnimating) return
          isAnimating = true
          triggerHearts(3)
          idx++
          isAnimating = false
          resolve()
        }
      })
    }

    // 淡入文字结束后，继续下一个非淡入文字的场景
    while (idx < scenes.length && scenes[idx].type === 'fade-text') {
      idx++
    }

    if (idx < scenes.length) {
      currentSceneIndex = idx

      if (scenes[idx].type === 'photo') {
        hideAllScenes()
        await playPhotoScene(scenes[idx], idx)
      } else {
        await playScene(idx)
      }
    } else {
      // 到达结尾
      finishStory()
    }
  }

  /* ---------- 选择分支场景 ---------- */
  async function playChoiceScene(scene, index) {
    hideAllScenes()
    showScene('choice')

    choiceQuestion.textContent = scene.question
    fadeIn(choiceQuestion.parentElement)

    // 加选择提示
    let choiceHint = document.querySelector('.choice-hint')
    if (!choiceHint) {
      choiceHint = document.createElement('div')
      choiceHint.className = 'choice-hint'
      choiceQuestion.parentElement.after(choiceHint)
    }
    choiceHint.textContent = '选一个吧 💭'
    choiceHint.style.opacity = '0'
    choiceHint.style.transform = 'translateY(8px)'
    choiceHint.style.transition = 'all 0.6s ease 0.5s'
    requestAnimationFrame(() => {
      choiceHint.style.opacity = '0.7'
      choiceHint.style.transform = 'translateY(0)'
    })

    choiceGroup.innerHTML = ''
    await wait(300)

    scene.options.forEach((opt, i) => {
      const btn = document.createElement('button')
      btn.className = 'choice-btn'
      btn.textContent = opt.label
      btn.addEventListener('click', async () => {
        if (isAnimating) return
        isAnimating = true
        triggerHearts(5)

        hideAllScenes()
        showScene('story')
        storyText.textContent = ''
        nextBtn.style.display = 'inline-flex'
        nextBtn.textContent = '继续偷看'

        await wait(400)
        storyText.textContent = opt.nextText
        fadeIn(storyText.parentElement)

        // 噜噜出现
        showLulu()

        isAnimating = false

        await new Promise((resolve) => {
          nextBtn.onclick = () => {
            if (isAnimating) return
            isAnimating = true
            triggerHearts(3)
            currentSceneIndex = index + 1
            isAnimating = false
            hideAllScenes()
            playScene(currentSceneIndex)
            resolve()
          }
        })
      })
      choiceGroup.appendChild(btn)

      setTimeout(() => {
        btn.style.opacity = '0'
        btn.style.transform = 'translateY(10px)'
        btn.style.transition = 'all 0.4s ease ' + (i * 0.15) + 's'
        requestAnimationFrame(() => {
          btn.style.opacity = '1'
          btn.style.transform = 'translateY(0)'
        })
      }, 100)
    })

    currentSceneIndex = index
  }

  /* ---------- 照片浮现场景（从配置中加载照片） ---------- */
  async function playPhotoScene(scene, index) {
    hideAllScenes()
    showScene('photo')

    photoFrame.classList.remove('visible')
    photoCaption.classList.remove('visible')

    photoFrame.innerHTML = ''

    const photoIndex = scene.photoIndex
    let photoSrc = null
    let caption = scene.caption || ''

    if (photoIndex !== undefined && STORY_CONFIG.photos[photoIndex]) {
      photoSrc = STORY_CONFIG.photos[photoIndex].src
      if (!scene.caption && STORY_CONFIG.photos[photoIndex].caption) {
        caption = STORY_CONFIG.photos[photoIndex].caption
      }
    }

    if (photoSrc) {
      const img = document.createElement('img')
      img.src = photoSrc
      img.alt = caption || '照片'
      img.onerror = function () {
        img.style.display = 'none'
        const placeholder = document.createElement('div')
        placeholder.className = 'photo-placeholder'
        placeholder.innerHTML = '<span>📷</span><span>照片加载失败，请检查路径</span>'
        photoFrame.appendChild(placeholder)
      }
      photoFrame.appendChild(img)
    } else {
      const placeholder = document.createElement('div')
      placeholder.className = 'photo-placeholder'
      placeholder.innerHTML = '<span>📷</span><span>请替换为你的照片</span>'
      photoFrame.appendChild(placeholder)
    }

    photoCaption.textContent = caption

    await wait(500)
    photoFrame.classList.add('visible')

    await wait(600)
    if (caption) {
      photoCaption.classList.add('visible')
    }

    photoNextBtn.style.display = 'inline-flex'
    photoNextBtn.textContent = '继续偷看'

    currentSceneIndex = index

    return new Promise((resolve) => {
      photoNextBtn.onclick = () => {
        if (isAnimating) return
        isAnimating = true
        triggerHearts(5)
        currentSceneIndex = index + 1
        isAnimating = false
        hideAllScenes()
        playScene(currentSceneIndex)
        resolve()
      }
    })
  }

  /* ---------- 高潮场景 ---------- */
  async function playClimaxScene(scene, index) {
    hideAllScenes()
    showScene('climax')

    climaxText.innerHTML = ''

    for (let i = 0; i < scene.lines.length; i++) {
      const line = document.createElement('div')
      line.className = 'climax-line'
      line.textContent = scene.lines[i]
      climaxText.appendChild(line)

      await wait(300)
      line.classList.add('visible')
      await wait(800)
    }

    climaxNextBtn.style.display = 'inline-flex'
    climaxNextBtn.textContent = '继续偷看'

    currentSceneIndex = index

    return new Promise((resolve) => {
      climaxNextBtn.onclick = () => {
        if (isAnimating) return
        isAnimating = true
        triggerHearts(10)

        // 噜噜出现
        showLulu()
        setTimeout(() => {
          if (luluVisible) {
            showLuluBubble('呜…好感动呀 ❤️')
          }
        }, 1000)

        currentSceneIndex = index + 1
        isAnimating = false
        hideAllScenes()
        playScene(currentSceneIndex)
        resolve()
      }
    })
  }

  /* ---------- 结尾场景 ---------- */
  async function playEndingScene(scene, index) {
    hideAllScenes()
    showScene('ending')

    endingText.textContent = ''
    endingSubtitle.textContent = ''

    await wait(600)

    endingText.textContent = scene.text
    fadeIn(endingText)

    await wait(1200)

    if (scene.subtitle) {
      endingSubtitle.textContent = scene.subtitle
      fadeIn(endingSubtitle, 200)
    }

    // 掉落大量爱心
    setTimeout(() => triggerHearts(20), 800)
    setTimeout(() => triggerHearts(15), 2000)
    setTimeout(() => triggerHearts(10), 3500)

    // 噜噜出现
    setTimeout(() => {
      showLulu()
      setTimeout(() => {
        const whispers = STORY_CONFIG.luluWhispers
        const msg = whispers[Math.floor(Math.random() * whispers.length)]
        showLuluBubble(msg)
      }, 1500)
    }, 2000)

    currentSceneIndex = index
  }

  /* ---------- 剧情结束（兜底） ---------- */
  function finishStory() {
    const scenes = STORY_CONFIG.scenes
    const lastScene = scenes[scenes.length - 1]
    if (lastScene && lastScene.type === 'ending') {
      playEndingScene(lastScene, scenes.length - 1)
    }
  }

  /* ---------- 进度指示 ---------- */
  function addProgressDots(index) {
    const container = document.querySelector('.progress-dots')
    if (container) container.remove()

    const dots = document.createElement('div')
    dots.className = 'progress-dots'

    const total = STORY_CONFIG.scenes.filter(s => s.type !== 'typewriter').length
    const current = STORY_CONFIG.scenes.slice(0, index + 1).filter(s => s.type !== 'typewriter').length

    for (let i = 0; i < Math.min(total, 8); i++) {
      const dot = document.createElement('span')
      dot.className = 'progress-dot' + (i <= current ? ' active' : '')
      dots.appendChild(dot)
    }

    const card = document.querySelector('#scene-story .glass-card')
    if (card) {
      card.after(dots)
    }
  }

  /* ---------- 爱心掉落 ---------- */
  function triggerHearts(count = 8) {
    const hearts = ['♥', '♡', '❤', '💕', '💗']
    const containerWidth = window.innerWidth

    for (let i = 0; i < count; i++) {
      const heart = document.createElement('span')
      heart.className = 'heart-drop'
      heart.textContent = hearts[Math.floor(Math.random() * hearts.length)]
      heart.style.left = (10 + Math.random() * 80) + '%'
      heart.style.fontSize = (0.8 + Math.random() * 0.8) + 'rem'
      heart.style.animationDuration = (2 + Math.random() * 2) + 's'
      heart.style.animationDelay = (Math.random() * 0.5) + 's'
      heartsContainer.appendChild(heart)

      setTimeout(() => {
        heart.remove()
      }, 5000)
    }
  }

  /* ---------- 点击波纹 ---------- */
  function createRipple(x, y) {
    const ripple = document.createElement('div')
    ripple.className = 'ripple'
    ripple.style.left = x + 'px'
    ripple.style.top = y + 'px'
    rippleContainer.appendChild(ripple)

    setTimeout(() => ripple.remove(), 800)
  }

  /* ---------- 噜噜 ---------- */
  function showLulu() {
    if (Math.random() > STORY_CONFIG.luluFrequency) return

    lulu.classList.add('show')
    luluVisible = true

    clearTimeout(luluTimeout)
    luluTimeout = setTimeout(() => {
      hideLulu()
    }, 5000)
  }

  function hideLulu() {
    lulu.classList.remove('show')
    luluBubble.classList.remove('show')
    luluVisible = false
  }

  function showLuluBubble(text) {
    luluBubble.textContent = text
    luluBubble.classList.add('show')
    clearTimeout(luluTimeout)

    luluTimeout = setTimeout(() => {
      luluBubble.classList.remove('show')
      luluTimeout = setTimeout(() => hideLulu(), 2000)
    }, 3000)
  }

  lulu.addEventListener('click', function () {
    if (!luluVisible) return
    const whispers = STORY_CONFIG.luluWhispers
    const msg = whispers[Math.floor(Math.random() * whispers.length)]
    showLuluBubble(msg)
  })

  // 噜噜随机出现（每8秒有30%概率探头，比之前更频繁）
  setInterval(() => {
    if (document.hidden) return
    if (luluVisible) return

    const activeScene = Object.values(scenes).find(s => s.classList.contains('active'))
    if (!activeScene) return

    if (activeScene === scenes.ending) return

    if (Math.random() < 0.3) {
      showLulu()
    }
  }, 8000)

  /* ---------- 隐藏台词（长按） ---------- */
  function showHiddenLine() {
    const lines = STORY_CONFIG.hiddenLines
    const line = lines[Math.floor(Math.random() * lines.length)]
    hiddenToast.textContent = line
    hiddenToast.classList.add('show')

    setTimeout(() => {
      hiddenToast.classList.remove('show')
    }, 2500)
  }

  /* ---------- 长按检测 ---------- */
  document.addEventListener('mousedown', function (e) {
    if (e.target.closest('.btn') || e.target.closest('.choice-btn') ||
      e.target.closest('.note-wrapper') || e.target.closest('.music-btn') ||
      e.target.closest('.lulu')) return

    isLongPress = false
    longPressTimer = setTimeout(() => {
      isLongPress = true
      showHiddenLine()
    }, 1200)
  })

  document.addEventListener('mouseup', function () {
    clearTimeout(longPressTimer)
  })

  document.addEventListener('mouseleave', function () {
    clearTimeout(longPressTimer)
  })

  // 触屏长按
  document.addEventListener('touchstart', function (e) {
    if (e.target.closest('.btn') || e.target.closest('.choice-btn') ||
      e.target.closest('.note-wrapper') || e.target.closest('.music-btn') ||
      e.target.closest('.lulu')) return

    isLongPress = false
    longPressTimer = setTimeout(() => {
      isLongPress = true
      showHiddenLine()
    }, 1200)
  }, { passive: true })

  document.addEventListener('touchend', function () {
    clearTimeout(longPressTimer)
  })

  document.addEventListener('touchcancel', function () {
    clearTimeout(longPressTimer)
  })

  /* ---------- 点击波纹触发 ---------- */
  document.addEventListener('click', function (e) {
    if (e.target.closest('.btn') || e.target.closest('.choice-btn') ||
      e.target.closest('.note-wrapper') || e.target.closest('.music-btn') ||
      e.target.closest('.lulu') || e.target.closest('.lulu-container') ||
      e.target.closest('.hearts-container') || e.target.closest('.ripple-container')) return

    createRipple(e.clientX, e.clientY)
  })

  document.addEventListener('touchstart', function (e) {
    if (e.target.closest('.btn') || e.target.closest('.choice-btn') ||
      e.target.closest('.note-wrapper') || e.target.closest('.music-btn') ||
      e.target.closest('.lulu') || e.target.closest('.lulu-container')) return

    const touch = e.touches[0]
    createRipple(touch.clientX, touch.clientY)
  }, { passive: true })

  /* ---------- 音乐控制 ---------- */
  musicBtn.addEventListener('click', async function () {
    if (!audioContext) {
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)()
        musicGain = audioContext.createGain()
        musicGain.connect(audioContext.destination)
        musicGain.gain.value = 0.3

        // 尝试加载音乐文件
        const response = await fetch(STORY_CONFIG.music.src)
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer()
          musicBuffer = await audioContext.decodeAudioData(arrayBuffer)
        }
      } catch (e) {
        console.log('音乐文件未找到，使用无声音频占位')
      }
    }

    if (!musicPlaying) {
      if (audioContext) {
        if (audioContext.state === 'suspended') {
          await audioContext.resume()
        }

        if (musicBuffer && !musicSource) {
          musicSource = audioContext.createBufferSource()
          musicSource.buffer = musicBuffer
          musicSource.loop = STORY_CONFIG.music.loop
          musicSource.connect(musicGain)
          musicSource.start(0)
        }
      }
      musicPlaying = true
      musicBtn.classList.add('playing')
      musicBtn.textContent = '♫'
    } else {
      if (musicSource) {
        try {
          musicSource.stop()
        } catch (e) { }
        musicSource = null
      }
      musicPlaying = false
      musicBtn.classList.remove('playing')
      musicBtn.textContent = '♪'
    }
  })

  /* ---------- 初始化 ---------- */
  async function init() {
    // 显示第一个打字机场景
    hideAllScenes()
    showScene('opening')

    // 开始打字机序列
    let idx = 0
    const scenes = STORY_CONFIG.scenes

    while (idx < scenes.length && scenes[idx].type === 'typewriter') {
      const scene = scenes[idx]
      showScene('opening')
      typewriterEl.style.visibility = 'hidden'
      await wait(800)
      await typewriter(typewriterEl, scene.text, 50)
      await wait(1500)
      idx++
    }

    // 打字机结束后显示纸条
    hideAllScenes()
    showScene('note')
    noteHint.textContent = '轻触纸条展开'
    noteHint.style.opacity = '0.6'
    noteHint.style.cursor = 'default'
    currentSceneIndex = idx

    // 页面标题
    document.title = STORY_CONFIG.title || '一段慢慢展开的小回忆'

    // 首次进入掉落小爱心
    setTimeout(() => triggerHearts(8), 2000)
  }

  // 启动
  init()
})()