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
  const closeModal = document.querySelector(".close-modal")

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
    const savedTheme = localStorage.getItem("mindMapTheme")
    if (savedTheme === "dark") {
      document.body.setAttribute("data-theme", "dark")
    }
  }

  // Event Listeners
  function setupEventListeners() {
    // Toolbar buttons
    resetBtn.addEventListener("click", resetMindMap)
    zoomInBtn.addEventListener("click", () => changeZoom(0.1))
    zoomOutBtn.addEventListener("click", () => changeZoom(-0.1))
    exportBtn.addEventListener("click", () => (exportModal.style.display = "flex"))
    themeToggle.addEventListener("click", toggleTheme)

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
    closeModal.addEventListener("click", () => (exportModal.style.display = "none"))
    exportImage.addEventListener("click", exportAsImage)
    exportJson.addEventListener("click", exportAsJson)

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
  function createNode(text, x, y, parentId) {
    const id = nextNodeId++
    const node = {
      id,
      text,
      x,
      y,
      parentId,
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

    const nodeContent = document.createElement("div")
    nodeContent.className = "node-content"

    const nodeText = document.createElement("div")
    nodeText.className = "node-text"
    nodeText.textContent = node.text

    const addButton = document.createElement("button")
    addButton.className = "add-node-btn"
    addButton.textContent = "+"
    addButton.title = "Add child node"

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

      const newNode = createNode("New Idea", newX, newY, node.id)

      // Animate the new node
      const newNodeElement = document.getElementById(`node-${newNode.id}`)
      newNodeElement.style.animation = "nodeAppear 0.3s ease-out"
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

  function deleteNode(id) {
    // Get all descendant nodes recursively
    const nodesToDelete = getDescendantNodes(id)
    nodesToDelete.push(id)

    // Remove nodes and their connections
    nodes = nodes.filter((node) => !nodesToDelete.includes(node.id))
    connections = connections.filter((conn) => !nodesToDelete.includes(conn.from) && !nodesToDelete.includes(conn.to))

    // Remove node elements from DOM
    nodesToDelete.forEach((nodeId) => {
      const nodeElement = document.getElementById(`node-${nodeId}`)
      if (nodeElement) {
        nodeElement.remove()
      }
    })

    renderConnections()
    saveToLocalStorage()
  }

  function getDescendantNodes(nodeId) {
    const descendants = []
    const children = connections
      .filter((conn) => conn.from === nodeId)
      .map((conn) => conn.to)

    children.forEach((childId) => {
      descendants.push(childId)
      descendants.push(...getDescendantNodes(childId))
    })

    return descendants
  }

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

  function startPan(e) {
    if (e.target === mindMapContainer) {
      isPanning = true
      lastPanPoint = {
        x: e.clientX,
        y: e.clientY,
      }
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
  }

  function handleTouchStart(e) {
    if (e.touches.length === 2) {
      // Handle pinch zoom
      const touch1 = e.touches[0]
      const touch2 = e.touches[1]
      lastPinchDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      )
    } else if (e.touches.length === 1 && e.target === mindMapContainer) {
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
      const currentDistance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      )

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

  function changeZoom(delta) {
    const oldScale = scale
    scale = Math.max(0.1, Math.min(2, scale + delta))

    // Adjust translation to zoom towards mouse position
    const containerRect = mindMapContainer.getBoundingClientRect()
    const centerX = containerRect.width / 2
    const centerY = containerRect.height / 2

    translateX = centerX - (centerX - translateX) * (scale / oldScale)
    translateY = centerY - (centerY - translateY) * (scale / oldScale)

    applyTransform()
  }

  function handleWheel(e) {
    e.preventDefault()
    const delta = -Math.sign(e.deltaY) * 0.1
    changeZoom(delta)
  }

  function applyTransform() {
    mindMapContainer.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`
  }

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
          svg.appendChild(path)
        }
      }
    })
  }

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
    const nodeId = parseInt(contextMenu.dataset.nodeId)
    const action = e.target.dataset.action

    if (action === "delete") {
      deleteNode(nodeId)
    }

    hideContextMenu()
  }

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
    }
  }

  function toggleTheme() {
    const isDark = document.body.getAttribute("data-theme") === "dark"
    document.body.setAttribute("data-theme", isDark ? "light" : "dark")
    localStorage.setItem("mindMapTheme", isDark ? "light" : "dark")
  }

  function exportAsImage() {
    const container = document.querySelector(".app-container")
    html2canvas(container).then((canvas) => {
      const link = document.createElement("a")
      link.download = "mind-map.png"
      link.href = canvas.toDataURL()
      link.click()
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
  }

  function html2canvas(element) {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas")
      const context = canvas.getContext("2d")
      const rect = element.getBoundingClientRect()

      canvas.width = rect.width
      canvas.height = rect.height

      const data = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}">
          <foreignObject width="100%" height="100%">
            <div xmlns="http://www.w3.org/1999/xhtml">
              ${element.outerHTML}
            </div>
          </foreignObject>
        </svg>
      `

      const img = new Image()
      const svgBlob = new Blob([data], { type: "image/svg+xml;charset=utf-8" })
      const url = URL.createObjectURL(svgBlob)

      img.onload = () => {
        context.drawImage(img, 0, 0)
        URL.revokeObjectURL(url)
        resolve(canvas)
      }

      img.src = url
    })
  }

  function renderMindMap() {
    nodes.forEach((node) => {
      renderNode(node)
    })
    renderConnections()
  }

  // Start the application
  init()
}) 