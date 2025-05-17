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
  const defaultNodeColor = "#6366f1"

  // Initialize
  function init() {
    loadFromLocalStorage()
    setupEventListeners()
    renderMindMap()

    // Create root node if no nodes exist
    if (nodes.length === 0) {
      createNode("Main Idea", window.innerWidth / 2 - 75, window.innerHeight / 2 - 30, null)
    }

    // Load theme preference
    const savedTheme = localStorage.getItem("theme")
    if (savedTheme === "dark") {
      document.body.classList.add("dark-theme")
    }

    // Show welcome toast
    showToast("Welcome to Mind Map Builder", "info")
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
    nodeText.textContent = node.text

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
      if (e.target !== addButton && !e.target.closest(".add-node-btn")) {
        startDrag(e, node.id)
      }
    })

    nodeElement.addEventListener("touchstart", (e) => {
      if (e.target !== addButton && !e.target.closest(".add-node-btn")) {
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
      if (e.target.classList.contains("node-text") || e.target.closest(".node-text")) {
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
      const containerRect = mindMapContainer.getBoundingClientRect()

      const newX = node.x + 180
      const newY = node.y

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
          const containerRect = mindMapContainer.getBoundingClientRect()

          const fromX = fromRect.left + fromRect.width / 2 - containerRect.left
          const fromY = fromRect.top + fromRect.height / 2 - containerRect.top
          const toX = toRect.left + toRect.width / 2 - containerRect.left
          const toY = toRect.top + toRect.height / 2 - containerRect.top

          const path = document.createElementNS("http://www.w3.org/2000/svg", "path")
          path.setAttribute("d", `M ${fromX} ${fromY} L ${toX} ${toY}`)
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

    if (action === "delete") {
      deleteNode(nodeId)
    } else if (action === "rename") {
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
    } else if (action === "change-color") {
      activeColorNodeId = nodeId
      colorPickerModal.style.display = "flex"
    }

    hideContextMenu()
  }

  // Storage
  function saveToLocalStorage() {
    const data = {
      nodes,
      connections,
      nextNodeId,
    }
    localStorage.setItem("mindMapData", JSON.stringify(data))
  }

  function loadFromLocalStorage() {
    const savedData = localStorage.getItem("mindMapData")
    if (savedData) {
      const data = JSON.parse(savedData)
      nodes = data.nodes
      connections = data.connections
      nextNodeId = data.nextNodeId
    }
  }

  function resetMindMap() {
    if (confirm("Are you sure you want to reset the mind map? This will delete all nodes.")) {
      nodes = []
      connections = []
      nextNodeId = 1
      nodesContainer.innerHTML = ""
      connectionsContainer.innerHTML = ""
      createNode("Main Idea", window.innerWidth / 2 - 75, window.innerHeight / 2 - 30, null)
      saveToLocalStorage()
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
      html2canvas(mindMapContainer, { scale: 0.5 })
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

  // Polyfill for html2canvas
  function html2canvas(element) {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas")
      const context = canvas.getContext("2d")

      // Set canvas size to match the element
      canvas.width = element.offsetWidth
      canvas.height = element.offsetHeight

      // Draw background
      context.fillStyle = getComputedStyle(document.body).getPropertyValue("--bg-color")
      context.fillRect(0, 0, canvas.width, canvas.height)

      // Draw connections
      const connections = element.querySelectorAll(".connection")
      connections.forEach((conn) => {
        const x1 = Number.parseFloat(conn.getAttribute("x1"))
        const y1 = Number.parseFloat(conn.getAttribute("y1"))
        const x2 = Number.parseFloat(conn.getAttribute("x2"))
        const y2 = Number.parseFloat(conn.getAttribute("y2"))

        context.beginPath()
        context.moveTo(x1, y1)
        context.lineTo(x2, y2)
        context.strokeStyle = getComputedStyle(document.body).getPropertyValue("--connection-color")
        context.lineWidth = 2
        context.stroke()
      })

      // Draw nodes
      const nodes = element.querySelectorAll(".node")
      nodes.forEach((node) => {
        const rect = node.getBoundingClientRect()
        const containerRect = element.getBoundingClientRect()

        const x = rect.left - containerRect.left
        const y = rect.top - containerRect.top
        const width = rect.width
        const height = rect.height

        // Draw node background
        context.fillStyle = getComputedStyle(node).backgroundColor
        context.strokeStyle = getComputedStyle(node).borderColor
        context.lineWidth = 2
        context.beginPath()
        context.roundRect(x, y, width, height, 8)
        context.fill()
        context.stroke()

        // Draw node text
        const textElement = node.querySelector(".node-text")
        context.fillStyle = getComputedStyle(textElement).color
        context.font = getComputedStyle(textElement).font
        context.textBaseline = "top"
        context.fillText(textElement.textContent, x + 10, y + 10)
      })

      resolve(canvas)
    })
  }

  // Render the mind map
  function renderMindMap() {
    nodes.forEach((node) => {
      renderNode(node)
    })
    renderConnections()
  }

  // Polyfill for roundRect if not available
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, width, height, radius) {
      if (width < 2 * radius) radius = width / 2
      if (height < 2 * radius) radius = height / 2
      this.beginPath()
      this.moveTo(x + radius, y)
      this.arcTo(x + width, y, x + width, y + height, radius)
      this.arcTo(x + width, y + height, x, y + height, radius)
      this.arcTo(x, y + height, x, y, radius)
      this.arcTo(x, y, x + width, y, radius)
      this.closePath()
      return this
    }
  }

  // Initialize the app
  init()
})
