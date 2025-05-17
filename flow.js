document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const mindMapContainer = document.getElementById("mind-map-container")
  const nodesContainer = document.getElementById("nodes-container")
  const connectionsContainer = document.getElementById("connections")
  const resetBtn = document.getElementById("reset-btn")
  const zoomInBtn = document.getElementById("zoom-in-btn")
  const zoomOutBtn = document.getElementById("zoom-out-btn")
  const exportBtn = document.getElementById("export-btn")
  const themeToggle = document.getElementById("theme-toggle")
  const contextMenu = document.getElementById("context-menu")
  const exportModal = document.getElementById("export-modal")
  const exportImage = document.getElementById("export-image")
  const exportJson = document.getElementById("export-json")
  const exportResult = document.getElementById("export-result")
  const exportPreview = document.querySelector(".export-preview")
  const exportPreviewContainer = document.getElementById("export-preview-container")
  const exportLoading = document.getElementById("export-loading")
  const colorPickerModal = document.getElementById("color-picker-modal")
  const colorOptions = document.querySelectorAll(".color-option")
  const closeModalButtons = document.querySelectorAll(".close-modal")
  const floatZoomIn = document.getElementById("float-zoom-in")
  const floatZoomOut = document.getElementById("float-zoom-out")
  const floatReset = document.getElementById("float-reset")
  const toastContainer = document.getElementById("toast-container")

  // State
  let nodes = []
  let connections = []
  let activeNodeId = null
  let isDragging = false
  let dragOffset = { x: 0, y: 0 }
  let scale = 1
  let translateX = 0
  let translateY = 0
  let isPanning = false
  let lastPanPoint = { x: 0, y: 0 }
  let longPressTimer = null
  let nextNodeId = 1
  let lastPinchDistance = null
  let activeColorNodeId = null
  const defaultNodeColor = "#f5a88c" // Peach color for light theme

  // Initialize
  function init() {
    loadFromLocalStorage()
    setupEventListeners()
    renderMindMap()

    // Create root node if no nodes exist
    if (nodes.length === 0) {
      createNode("Main Idea", window.innerWidth / 2 - 60, window.innerHeight / 2 - 60, null)
    }

    // Load theme preference
    const savedTheme = localStorage.getItem("theme")
    if (savedTheme === "dark") {
      document.body.classList.add("dark-theme")
    }

    // Show welcome toast
    showToast("Welcome to Mind Map Builder", "info")
  }

  function renderMindMap() {
    // Render all nodes and connections
    nodes.forEach((node) => renderNode(node))
    renderConnections()
  }

  // Event Listeners
  function setupEventListeners() {
    // Toolbar buttons
    resetBtn.addEventListener("click", resetMindMap)
    zoomInBtn.addEventListener("click", () => changeZoom(0.1))
    zoomOutBtn.addEventListener("click", () => changeZoom(-0.1))
    exportBtn.addEventListener("click", () => {
      exportModal.style.display = "flex"
      generateExportPreview()
    })
    themeToggle.addEventListener("click", toggleTheme)

    // Floating buttons
    floatZoomIn.addEventListener("click", () => changeZoom(0.1))
    floatZoomOut.addEventListener("click", () => changeZoom(-0.1))
    floatReset.addEventListener("click", resetView)

    // Mind map container events for panning
    mindMapContainer.addEventListener("mousedown", startPan)
    mindMapContainer.addEventListener("mousemove", pan)
    mindMapContainer.addEventListener("mouseup", endPan)
    mindMapContainer.addEventListener("mouseleave", endPan)

    // Touch events for mobile
    mindMapContainer.addEventListener("touchstart", handleTouchStart)
    mindMapContainer.addEventListener("touchmove", handleTouchMove)
    mindMapContainer.addEventListener("touchend", handleTouchEnd)

    // Context menu
    document.addEventListener("click", hideContextMenu)
    contextMenu.addEventListener("click", handleContextMenuAction)

    // Export modal
    closeModalButtons.forEach((button) => {
      button.addEventListener("click", () => {
        exportModal.style.display = "none"
        colorPickerModal.style.display = "none"
      })
    })

    exportImage.addEventListener("click", exportAsImage)
    exportJson.addEventListener("click", exportAsJson)

    // Color picker
    colorOptions.forEach((option) => {
      option.addEventListener("click", () => {
        const color = option.dataset.color
        changeNodeColor(activeColorNodeId, color)
        colorPickerModal.style.display = "none"
      })
    })

    // Prevent context menu on right click
    document.addEventListener("contextmenu", (e) => {
      if (e.target.closest("#mind-map-container")) {
        e.preventDefault()
      }
    })

    // Zoom with mouse wheel
    mindMapContainer.addEventListener("wheel", handleWheel)

    // Window resize
    window.addEventListener("resize", renderConnections)
  }

  // Node Management
  function createNode(text, x, y, parentId, color = defaultNodeColor) {
    const id = nextNodeId++
    const node = {
      id,
      text,
      x,
      y,
      parentId,
      color,
      url: null, // For clickable links
      imageUrl: null, // For node images
    }

    nodes.push(node)

    if (parentId !== null) {
      connections.push({
        from: parentId,
        to: id,
      })
    }

    renderNode(node)
    renderConnections()
    saveToLocalStorage()

    return node
  }

  function renderNode(node) {
    const nodeElement = document.createElement("div")
    nodeElement.className = "node"
    nodeElement.id = `node-${node.id}`
    nodeElement.style.left = `${node.x}px`
    nodeElement.style.top = `${node.y}px`

    // Apply node color
    if (node.color) {
      nodeElement.style.borderColor = node.color
      nodeElement.style.boxShadow = `0 4px 12px ${node.color}33`
    }

    const nodeContent = document.createElement("div")
    nodeContent.className = "node-content"

    const nodeText = document.createElement("div")
    nodeText.className = "node-text"

    // Handle clickable links
    if (node.url) {
      const linkElement = document.createElement("a")
      linkElement.href = node.url
      linkElement.target = "_blank"
      linkElement.textContent = node.text
      linkElement.style.color = "inherit"
      linkElement.style.textDecoration = "underline"
      nodeText.appendChild(linkElement)
    } else {
      nodeText.textContent = node.text
    }

    // Handle node images
    if (node.imageUrl) {
      const imageElement = document.createElement("img")
      imageElement.src = node.imageUrl
      imageElement.alt = node.text
      imageElement.style.maxWidth = "100%"
      imageElement.style.borderRadius = "0.5rem"
      imageElement.style.marginBottom = "0.5rem"
      nodeContent.appendChild(imageElement)
    }

    const addButton = document.createElement("button")
    addButton.className = "add-node-btn"
    addButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    `
    addButton.title = "Add child node"

    // Apply button color
    if (node.color) {
      addButton.style.background = node.color
    }

    nodeContent.appendChild(nodeText)
    nodeContent.appendChild(addButton)
    nodeElement.appendChild(nodeContent)

    // Node event listeners
    nodeElement.addEventListener("mousedown", (e) => {
      if (e.target !== addButton && !e.target.closest(".add-node-btn") && !e.target.closest("a")) {
        startDrag(e, node.id)
      }
    })

    nodeElement.addEventListener("touchstart", (e) => {
      if (e.target !== addButton && !e.target.closest(".add-node-btn") && !e.target.closest("a")) {
        const touch = e.touches[0]
        startDrag({ clientX: touch.clientX, clientY: touch.clientY }, node.id)

        // Setup long press for context menu
        longPressTimer = setTimeout(() => {
          showContextMenu(touch.clientX, touch.clientY, node.id)
        }, 800)
      }
      e.stopPropagation()
    })

    nodeElement.addEventListener("touchend", () => {
      clearTimeout(longPressTimer)
    })

    nodeElement.addEventListener("touchmove", () => {
      clearTimeout(longPressTimer)
    })

    // Double click to edit
    nodeElement.addEventListener("dblclick", (e) => {
      if ((e.target.classList.contains("node-text") || e.target.closest(".node-text")) && !e.target.closest("a")) {
        const textElement = nodeElement.querySelector(".node-text")
        textElement.contentEditable = true
        textElement.focus()

        // Select all text
        const range = document.createRange()
        range.selectNodeContents(textElement)
        const selection = window.getSelection()
        selection.removeAllRanges()
        selection.addRange(range)
      }
    })

    // Save text on blur
    nodeElement.querySelector(".node-text").addEventListener("blur", (e) => {
      e.target.contentEditable = false
      const updatedText = e.target.textContent.trim()
      if (updatedText) {
        updateNodeText(node.id, updatedText)
      } else {
        e.target.textContent = node.text
      }
    })

    // Prevent drag when editing
    nodeElement.querySelector(".node-text").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault()
        e.target.blur()
      }
    })

    // Add child node
    addButton.addEventListener("click", (e) => {
      e.stopPropagation()

      // Calculate position for new node
      const parentRect = nodeElement.getBoundingClientRect()

      // Position differently based on if it's the main node
      let newX, newY
      if (node.id === 1) {
        // For main node, position based on available space
        const angle = Math.random() * Math.PI * 2
        const distance = 180
        newX = node.x + Math.cos(angle) * distance
        newY = node.y + Math.sin(angle) * distance
      } else {
        // For other nodes, position to the right
        newX = node.x + 180
        newY = node.y
      }

      const newNode = createNode("New Idea", newX, newY, node.id, node.color)

      // Animate the new node
      const newNodeElement = document.getElementById(`node-${newNode.id}`)
      newNodeElement.style.animation = "nodeAppear 0.3s ease-out"

      showToast("New node created", "success")
    })

    // Right click for context menu
    nodeElement.addEventListener("contextmenu", (e) => {
      e.preventDefault()
      showContextMenu(e.clientX, e.clientY, node.id)
    })

    nodesContainer.appendChild(nodeElement)
  }

  function updateNodeText(id, text) {
    const node = nodes.find((n) => n.id === id)
    if (node) {
      node.text = text
      saveToLocalStorage()
    }
  }

  function changeNodeColor(id, color) {
    const node = nodes.find((n) => n.id === id)
    if (node) {
      node.color = color

      const nodeElement = document.getElementById(`node-${id}`)
      if (nodeElement) {
        nodeElement.style.borderColor = color
        nodeElement.style.boxShadow = `0 4px 12px ${color}33`

        const addButton = nodeElement.querySelector(".add-node-btn")
        if (addButton) {
          addButton.style.background = color
        }
      }

      saveToLocalStorage()
      renderConnections()
      showToast("Node color updated", "success")
    }
  }

  function deleteNode(id) {
    // Get all descendant nodes recursively
    const nodesToDelete = getDescendantNodes(id)
    nodesToDelete.push(id)

    // Remove nodes and their connections
    nodes = nodes.filter((node) => !nodesToDelete.includes(node.id))
    connections = connections.filter((conn) => !nodesToDelete.includes(conn.from) && !nodesToDelete.includes(conn.to))

    // Remove node elements
    nodesToDelete.forEach((nodeId) => {
      const nodeElement = document.getElementById(`node-${nodeId}`)
      if (nodeElement) {
        nodeElement.remove()
      }
    })

    renderConnections()
    saveToLocalStorage()
    showToast("Node deleted", "info")
  }

  function getDescendantNodes(nodeId) {
    const descendants = []
    const children = connections.filter((conn) => conn.from === nodeId).map((conn) => conn.to)

    children.forEach((childId) => {
      descendants.push(childId)
      descendants.push(...getDescendantNodes(childId))
    })

    return descendants
  }

  // Drag and Drop
  function startDrag(e, nodeId) {
    isDragging = true
    activeNodeId = nodeId
    const node = nodes.find((n) => n.id === nodeId)
    const nodeElement = document.getElementById(`node-${nodeId}`)

    if (node && nodeElement) {
      const rect = nodeElement.getBoundingClientRect()
      dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
      nodeElement.classList.add("dragging")
    }

    document.addEventListener("mousemove", drag)
    document.addEventListener("mouseup", endDrag)
    document.addEventListener("touchmove", handleTouchMove)
    document.addEventListener("touchend", endDrag)
  }

  function drag(e) {
    if (!isDragging || activeNodeId === null) return

    const node = nodes.find((n) => n.id === activeNodeId)
    const nodeElement = document.getElementById(`node-${activeNodeId}`)

    if (node && nodeElement) {
      const x = e.clientX - dragOffset.x
      const y = e.clientY - dragOffset.y

      node.x = x
      node.y = y
      nodeElement.style.left = `${x}px`
      nodeElement.style.top = `${y}px`

      renderConnections()
    }
  }

  function endDrag() {
    if (isDragging && activeNodeId !== null) {
      const nodeElement = document.getElementById(`node-${activeNodeId}`)
      if (nodeElement) {
        nodeElement.classList.remove("dragging")
      }
      isDragging = false
      activeNodeId = null
      saveToLocalStorage()
    }

    document.removeEventListener("mousemove", drag)
    document.removeEventListener("mouseup", endDrag)
    document.removeEventListener("touchmove", handleTouchMove)
    document.removeEventListener("touchend", endDrag)
  }

  // Panning
  function startPan(e) {
    if (e.target === mindMapContainer || e.target === connectionsContainer) {
      isPanning = true
      lastPanPoint = {
        x: e.clientX,
        y: e.clientY,
      }
      mindMapContainer.style.cursor = "grabbing"
    }
  }

  function pan(e) {
    if (!isPanning) return

    const deltaX = e.clientX - lastPanPoint.x
    const deltaY = e.clientY - lastPanPoint.y

    translateX += deltaX
    translateY += deltaY

    lastPanPoint = {
      x: e.clientX,
      y: e.clientY,
    }

    applyTransform()
  }

  function endPan() {
    isPanning = false
    mindMapContainer.style.cursor = "default"
  }

  // Touch Handlers
  function handleTouchStart(e) {
    if (e.touches.length === 2) {
      // Handle pinch zoom
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      lastPinchDistance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY)
    } else if (e.touches.length === 1 && (e.target === mindMapContainer || e.target === connectionsContainer)) {
      // Handle pan
      isPanning = true
      lastPanPoint = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      }
    }
  }

  function handleTouchMove(e) {
    if (e.touches.length === 2) {
      // Handle pinch zoom
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      const currentDistance = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY)

      if (lastPinchDistance) {
        const delta = (currentDistance - lastPinchDistance) / 100
        changeZoom(delta)
        lastPinchDistance = currentDistance
      }
    } else if (e.touches.length === 1 && isPanning) {
      // Handle pan
      const touch = e.touches[0]
      const deltaX = touch.clientX - lastPanPoint.x
      const deltaY = touch.clientY - lastPanPoint.y

      translateX += deltaX
      translateY += deltaY

      lastPanPoint = {
        x: touch.clientX,
        y: touch.clientY,
      }

      applyTransform()
    }
  }

  function handleTouchEnd(e) {
    if (e.touches.length < 2) {
      lastPinchDistance = null
    }
    if (e.touches.length === 0) {
      isPanning = false
    }
  }

  // Zoom
  function changeZoom(delta) {
    const oldScale = scale
    scale = Math.max(0.1, Math.min(2, scale + delta))

    // Adjust translation to zoom towards center
    const containerRect = mindMapContainer.getBoundingClientRect()
    const centerX = containerRect.width / 2
    const centerY = containerRect.height / 2

    translateX = centerX - (centerX - translateX) * (scale / oldScale)
    translateY = centerY - (centerY - translateY) * (scale / oldScale)

    applyTransform()
    saveToLocalStorage()
  }

  function resetView() {
    scale = 1
    translateX = 0
    translateY = 0
    applyTransform()
    showToast("View reset", "info")
  }

  function handleWheel(e) {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.05 : 0.05
    changeZoom(delta)
  }

  function applyTransform() {
    nodesContainer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`
    connectionsContainer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`
  }

  // Connections
  function renderConnections() {
    // Clear existing connections
    connectionsContainer.innerHTML = ""

    // Create SVG for connections
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    svg.setAttribute("width", "100%")
    svg.setAttribute("height", "100%")
    connectionsContainer.appendChild(svg)

    // Draw connections
    connections.forEach((connection) => {
      const fromNode = nodes.find((n) => n.id === connection.from)
      const toNode = nodes.find((n) => n.id === connection.to)

      if (fromNode && toNode) {
        const fromElement = document.getElementById(`node-${fromNode.id}`)
        const toElement = document.getElementById(`node-${toNode.id}`)

        if (fromElement && toElement) {
          const fromRect = fromElement.getBoundingClientRect()
          const toRect = toElement.getBoundingClientRect()

          // Calculate center points
          const fromCenterX = fromNode.x + fromElement.offsetWidth / 2
          const fromCenterY = fromNode.y + fromElement.offsetHeight / 2
          const toCenterX = toNode.x + toElement.offsetWidth / 2
          const toCenterY = toNode.y + toElement.offsetHeight / 2

          // Create SVG path
          const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
          path.setAttribute("d", `M ${fromCenterX} ${fromCenterY} L ${toCenterX} ${toCenterY}`)
          path.setAttribute("class", "connection")

          // Apply node color to connection if available
          if (fromNode.color) {
            path.setAttribute("stroke", fromNode.color)
          }

          svg.appendChild(path)
        }
      }
    })
  }

  // Context Menu
  function showContextMenu(x, y, nodeId) {
    contextMenu.style.display = "block"
    contextMenu.style.left = `${x}px`
    contextMenu.style.top = `${y}px`
    contextMenu.dataset.nodeId = nodeId
  }

  function hideContextMenu() {
    contextMenu.style.display = "none"
  }

  function handleContextMenuAction(e) {
    const nodeId = Number.parseInt(contextMenu.dataset.nodeId)
    const action = e.target.closest("li")?.dataset.action

    if (!action || !nodeId) return

    switch (action) {
      case "delete":
        deleteNode(nodeId)
        break
      case "rename":
        const nodeElement = document.getElementById(`node-${nodeId}`)
        if (nodeElement) {
          const textElement = nodeElement.querySelector(".node-text")
          textElement.contentEditable = true
          textElement.focus()

          // Select all text
          const range = document.createRange()
          range.selectNodeContents(textElement)
          const selection = window.getSelection()
          selection.removeAllRanges()
          selection.addRange(range)
        }
        break
      case "change-color":
        activeColorNodeId = nodeId
        colorPickerModal.style.display = "flex"
        break
    }

    hideContextMenu()
  }

  // Storage
  function saveToLocalStorage() {
    const data = {
      nodes,
      connections,
      nextNodeId,
      viewState: {
        scale,
        translateX,
        translateY,
      },
    }

    localStorage.setItem("mindMapData", JSON.stringify(data))
  }

  function loadFromLocalStorage() {
    const data = localStorage.getItem("mindMapData")

    if (data) {
      const parsedData = JSON.parse(data)
      nodes = parsedData.nodes || []
      connections = parsedData.connections || []
      nextNodeId = parsedData.nextNodeId || 1

      if (parsedData.viewState) {
        scale = parsedData.viewState.scale || 1
        translateX = parsedData.viewState.translateX || 0
        translateY = parsedData.viewState.translateY || 0
        applyTransform()
      }
    }
  }

  function resetMindMap() {
    if (confirm("Are you sure you want to reset the mind map? This will delete all nodes.")) {
      localStorage.removeItem("mindMapData")

      // Clear DOM
      nodesContainer.innerHTML = ""
      while (connectionsContainer.firstChild) {
        connectionsContainer.removeChild(connectionsContainer.firstChild)
      }

      // Reset state
      nodes = []
      connections = []
      nextNodeId = 1
      scale = 1
      translateX = 0
      translateY = 0
      applyTransform()

      // Create root node
      createNode("Main Idea", window.innerWidth / 2 - 60, window.innerHeight / 2 - 60, null)

      showToast("Mind map reset", "info")
    }
  }

  // Theme Toggle
  function toggleTheme() {
    document.body.classList.toggle("dark-theme")
    const isDark = document.body.classList.contains("dark-theme")
    localStorage.setItem("theme", isDark ? "dark" : "light")
    showToast(`${isDark ? "Dark" : "Light"} theme activated`, "info")
  }

  // Export Functions
  function generateExportPreview() {
    exportPreview.style.display = "block"
    exportLoading.style.display = "flex"
    exportPreviewContainer.innerHTML = ""

    setTimeout(() => {
      html2canvas(mindMapContainer)
        .then((canvas) => {
          exportLoading.style.display = "none"
          exportPreviewContainer.appendChild(canvas)
          canvas.style.width = "100%"
          canvas.style.height = "auto"
        })
        .catch((error) => {
          exportLoading.style.display = "none"
          showToast("Failed to generate preview", "error")
          console.error("Export preview error:", error)
        })
    }, 500)
  }

  // Import html2canvas library
  const html2canvas = window.html2canvas

  function exportAsImage() {
    exportLoading.style.display = "flex"

    html2canvas(mindMapContainer)
      .then((canvas) => {
        exportLoading.style.display = "none"

        // Create download link
        const link = document.createElement("a")
        link.download = "mind-map.png"
        link.href = canvas.toDataURL("image/png")
        link.click()

        showToast("Mind map exported as image", "success")
      })
      .catch((error) => {
        exportLoading.style.display = "none"
        showToast("Failed to export image", "error")
        console.error("Export error:", error)
      })
  }

  function exportAsJson() {
    const data = {
      nodes,
      connections,
    }
    const jsonString = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonString], { type: "application/json" })
    const link = document.createElement("a")
    link.download = "mind-map.json"
    link.href = URL.createObjectURL(blob)
    link.click()

    showToast("Mind map exported as JSON", "success")
  }

  function showToast(message, type = "info") {
    const toast = document.createElement("div")
    toast.className = `toast ${type}`

    let icon = ""
    if (type === "success") {
      icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>`
    } else if (type === "error") {
      icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>`
    } else {
      icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>`
    }

    toast.innerHTML = `${icon}<span>${message}</span>`
    toastContainer.appendChild(toast)

    setTimeout(() => {
      toast.style.opacity = "0"
      setTimeout(() => {
        toast.remove()
      }, 300)
    }, 3000)
  }

  // Initialize the app
  init()
})
