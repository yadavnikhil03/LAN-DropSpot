class LANDropSpotEnhanced {
  constructor() {
    this.ws = null
    this.reconnectAttempts = 0
    this.maxReconnectAttempts = 5
    this.reconnectDelay = 1000

    // DOM elements
    this.dropZone = document.getElementById("drop-zone")
    this.fileInput = document.getElementById("file-input")
    this.browseBtn = document.getElementById("browse-btn")
    this.uploadProgress = document.getElementById("upload-progress")
    this.uploadItems = document.getElementById("upload-items")
    this.uploadCount = document.getElementById("upload-count")
    this.filesGrid = document.getElementById("files-grid")
    this.emptyState = document.getElementById("empty-state")
    this.serverIp = document.getElementById("server-ip")
    this.refreshBtn = document.getElementById("refresh-btn")
    this.clearAllBtn = document.getElementById("clear-all-btn")
    this.fileCount = document.getElementById("file-count")
    this.expiryTime = document.getElementById("expiry-time")
    this.wsIndicator = document.getElementById("ws-indicator")
    this.connectionStatus = document.querySelector("#connection-status span")
    this.connectionText = document.getElementById("connection-text")
    this.wsGlow = document.getElementById("ws-glow")
    this.typewriterText = document.getElementById("typewriter-text")
    this.typewriterCursor = document.getElementById("typewriter-cursor")
    this.fallbackLoading = document.getElementById("fallback-loading")
    this.fallbackMessage = document.getElementById("fallback-message")
    this.mainLoading = document.getElementById("main-loading")
    this.mainLoadingMessage = document.getElementById("main-loading-message")

    // Debug: Check if elements were found
    console.log("Refresh button found:", !!this.refreshBtn)
    console.log("Clear all button found:", !!this.clearAllBtn)
    console.log("Typewriter elements found:", !!this.typewriterText, !!this.typewriterCursor)
    console.log("Loading elements found:", !!this.mainLoading, !!this.fallbackLoading)
    
    if (this.typewriterText) {
      console.log("Typewriter text element:", this.typewriterText)
    }
    if (this.typewriterCursor) {
      console.log("Typewriter cursor element:", this.typewriterCursor)
    }

    this.files = new Map()
    this.uploadingFiles = new Map()
    this.typewriterTimeout = null
    this.isTyping = false

    this.init()
    this.showMainLoading("Starting LAN DropSpot...")
    this.startTypewriterEffect()
    this.connectWebSocket()
    this.loadServerStatus()
    this.loadFiles()

    // Update timers every second
    setInterval(() => this.updateFileTimers(), 1000)
  }

  init() {
    // Drag and drop events
    this.dropZone.addEventListener("dragover", this.handleDragOver.bind(this))
    this.dropZone.addEventListener("dragleave", this.handleDragLeave.bind(this))
    this.dropZone.addEventListener("drop", this.handleDrop.bind(this))
    this.dropZone.addEventListener("click", () => this.fileInput.click())

    // File input
    this.fileInput.addEventListener("change", this.handleFileSelect.bind(this))

    // Buttons
    this.browseBtn.addEventListener("click", (e) => {
      e.stopPropagation()
      this.fileInput.click()
    })

    this.refreshBtn.addEventListener("click", () => {
      console.log("Refresh button clicked")
      this.loadFiles()
    })
    this.clearAllBtn.addEventListener("click", () => {
      console.log("Clear all button clicked")
      this.clearAllFiles()
    })

    // Prevent default drag behaviors
    document.addEventListener("dragover", (e) => e.preventDefault())
    document.addEventListener("drop", (e) => e.preventDefault())
  }

  startTypewriterEffect() {
    console.log("Starting typewriter effect...")
    
    if (!this.typewriterText) {
      console.error("Typewriter text element not found!")
      return
    }
    
    const messages = [
      "Lightning Fast • Zero Setup • LAN Powered",
      "Drop files and share instantly",
      "Secure local network sharing",
      "No cloud, just pure speed",
      "Your network, your files, your control",
      "Zero configuration required",
      "Real-time file sharing made easy"
    ]
    
    let currentMessageIndex = 0
    
    const typeMessage = () => {
      console.log("Typing message:", messages[currentMessageIndex])
      
      const message = messages[currentMessageIndex]
      let charIndex = 0
      this.isTyping = true
      
      // Show cursor
      if (this.typewriterCursor) {
        this.typewriterCursor.style.display = 'inline'
      }
      
      // Clear current text
      this.typewriterText.textContent = ''
      
      const typeChar = () => {
        if (charIndex < message.length) {
          this.typewriterText.textContent += message.charAt(charIndex)
          charIndex++
          this.typewriterTimeout = setTimeout(typeChar, 80 + Math.random() * 40) // Slower, more readable
        } else {
          this.isTyping = false
          console.log("Finished typing message, waiting 4 seconds...")
          // Wait before starting next message
          this.typewriterTimeout = setTimeout(() => {
            currentMessageIndex = (currentMessageIndex + 1) % messages.length
            typeMessage()
          }, 4000) // Longer pause to read the message
        }
      }
      
      typeChar()
    }
    
    typeMessage()
  }

  typeWriterMessage(message, callback = null) {
    if (!this.typewriterText) {
      console.warn("Typewriter not available, using fallback loading")
      this.showFallbackLoading(message)
      if (callback) {
        setTimeout(callback, 1000)
      }
      return
    }
    
    // Clear any existing timeout
    if (this.typewriterTimeout) {
      clearTimeout(this.typewriterTimeout)
    }
    
    this.isTyping = true
    let charIndex = 0
    
    // Show cursor
    if (this.typewriterCursor) {
      this.typewriterCursor.style.display = 'inline'
    }
    
    // Clear current text
    this.typewriterText.textContent = ''
    
    const typeChar = () => {
      if (charIndex < message.length) {
        this.typewriterText.textContent += message.charAt(charIndex)
        charIndex++
        this.typewriterTimeout = setTimeout(typeChar, 60 + Math.random() * 40) // Slower for status messages
      } else {
        this.isTyping = false
        if (callback) {
          setTimeout(callback, 1500) // Wait 1.5 seconds before callback
        } else {
          // Resume normal typewriter after 3 seconds
          setTimeout(() => this.startTypewriterEffect(), 3000)
        }
      }
    }
    
    typeChar()
  }

  showFallbackLoading(message = "Loading...") {
    if (this.fallbackLoading && this.fallbackMessage) {
      this.fallbackMessage.textContent = message
      this.fallbackLoading.classList.remove("hidden")
      console.log("Showing fallback loading:", message)
    }
  }

  hideFallbackLoading() {
    if (this.fallbackLoading) {
      this.fallbackLoading.classList.add("hidden")
      console.log("Hiding fallback loading")
    }
  }

  showMainLoading(message = "Loading...") {
    if (this.mainLoading && this.mainLoadingMessage) {
      this.mainLoadingMessage.textContent = message
      this.mainLoading.classList.remove("hidden")
      console.log("Showing main loading:", message)
    }
  }

  hideMainLoading() {
    if (this.mainLoading) {
      this.mainLoading.classList.add("hidden")
      console.log("Hiding main loading")
    }
  }

  connectWebSocket() {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const wsUrl = `${protocol}//${window.location.host}/ws`

    try {
      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        console.log("WebSocket connected")
        this.reconnectAttempts = 0
        this.updateConnectionStatus("connected")
        this.hideMainLoading()
        this.hideFallbackLoading()
        this.typeWriterMessage("Connected! Ready to share files...")
      }

      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        this.handleWebSocketMessage(data)
      }

      this.ws.onclose = () => {
        console.log("WebSocket disconnected")
        this.updateConnectionStatus("disconnected")
        this.attemptReconnect()
      }

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error)
        this.updateConnectionStatus("error")
      }
    } catch (error) {
      console.error("Failed to connect WebSocket:", error)
      this.updateConnectionStatus("error")
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      this.updateConnectionStatus("connecting")

      setTimeout(() => {
        console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`)
        this.connectWebSocket()
      }, this.reconnectDelay * this.reconnectAttempts)
    }
  }

  updateConnectionStatus(status) {
    const statusConfig = {
      connected: {
        text: "Connected",
        dotColor: "bg-green-500",
        textColor: "text-green-600",
        glowColor: "bg-green-400",
        showGlow: true
      },
      disconnected: {
        text: "Disconnected",
        dotColor: "bg-red-500",
        textColor: "text-red-600",
        glowColor: "bg-red-400",
        showGlow: false
      },
      connecting: {
        text: "Connecting...",
        dotColor: "bg-yellow-500",
        textColor: "text-yellow-600",
        glowColor: "bg-yellow-400",
        showGlow: true
      },
      error: {
        text: "Connection Error",
        dotColor: "bg-red-600",
        textColor: "text-red-600",
        glowColor: "bg-red-400",
        showGlow: false
      }
    }

    const config = statusConfig[status] || statusConfig.error

    // Update the indicator dot
    if (this.wsIndicator) {
      this.wsIndicator.className = `relative w-3 h-3 ${config.dotColor} rounded-full transition-all duration-300 ${config.showGlow ? 'animate-pulse' : ''}`
    }

    // Update the glow effect
    if (this.wsGlow) {
      if (config.showGlow) {
        this.wsGlow.className = `absolute inset-0 rounded-full ${config.glowColor} opacity-75 blur-sm animate-ping transition-opacity duration-300`
        this.wsGlow.style.transform = 'scale(2)'
      } else {
        this.wsGlow.className = `absolute inset-0 rounded-full opacity-0 transition-opacity duration-300`
      }
    }

    // Update the text with enhanced styling
    if (this.connectionText) {
      this.connectionText.textContent = config.text
      this.connectionText.className = `text-xs font-tech font-bold ${config.textColor} transition-all duration-300 ${config.showGlow ? 'drop-shadow-sm' : ''}`
    }

    // Fallback for old connectionStatus element
    if (this.connectionStatus && !this.connectionText) {
      this.connectionStatus.textContent = config.text
    }
  }

  handleWebSocketMessage(data) {
    switch (data.type) {
      case "initial_files":
        this.displayFiles(data.files)
        break
      case "file_uploaded":
        this.addFileCard(data.file)
        this.showToast("📁 New file uploaded", `${data.file.name} is now available`)
        break
      case "file_downloaded":
        this.showToast("⬇️ File downloaded", `${data.filename} was downloaded`)
        break
      case "file_deleted":
        this.removeFileCard(data.file_id)
        break
      case "file_expired":
        this.removeFileCard(data.file_id)
        this.showToast("⏰ File expired", "A file has been automatically removed")
        break
    }
  }

  handleDragOver(e) {
    e.preventDefault()
    this.dropZone.classList.add("drag-over")
  }

  handleDragLeave(e) {
    e.preventDefault()
    if (!this.dropZone.contains(e.relatedTarget)) {
      this.dropZone.classList.remove("drag-over")
    }
  }

  handleDrop(e) {
    e.preventDefault()
    this.dropZone.classList.remove("drag-over")

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      this.uploadFiles(files)
    }
  }

  handleFileSelect(e) {
    const files = Array.from(e.target.files)
    if (files.length > 0) {
      this.uploadFiles(files)
    }
    e.target.value = ""
  }

  async uploadFiles(files) {
    if (files.length === 0) return

    this.showMainLoading(`Uploading ${files.length} files...`)
    this.typeWriterMessage(`Uploading ${files.length} files...`)
    this.showUploadProgress(files)

    const formData = new FormData()
    files.forEach((file) => formData.append("files", file))

    try {
      // Start progress simulation
      files.forEach((file, index) => {
        this.simulateUploadProgress(file.name, index)
      })

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || `Upload failed: ${response.statusText}`)
      }

      const result = await response.json()

      this.hideUploadProgress()
      this.showToast("✅ Upload successful", `${result.files.length} file(s) uploaded and ready to share`, "success")
      this.typeWriterMessage(`${result.files.length} files uploaded successfully!`)

      // Files will be added via WebSocket message
    } catch (error) {
      this.hideUploadProgress()
      this.showToast("❌ Upload failed", error.message, "error")
      this.typeWriterMessage("Upload failed. Please try again...")
      console.error("Upload error:", error)
    } finally {
      // Hide loading after minimum time
      setTimeout(() => {
        this.hideMainLoading()
      }, 3000) // Increased to 3 seconds for uploads
    }
  }

  showUploadProgress(files) {
    this.uploadProgress.classList.remove("hidden")
    this.uploadCount.textContent = `${files.length} file(s)`
    this.uploadItems.innerHTML = ""

    files.forEach((file) => {
      const template = document.getElementById("upload-progress-template")
      const item = template.content.cloneNode(true)

      item.querySelector(".upload-filename").textContent = file.name
      item.querySelector(".upload-percentage").textContent = "0%"

      this.uploadItems.appendChild(item)
    })
  }

  simulateUploadProgress(filename, index) {
    let progress = 0
    const progressBar = this.uploadItems.children[index]?.querySelector(".upload-progress-bar")
    const percentage = this.uploadItems.children[index]?.querySelector(".upload-percentage")

    if (!progressBar || !percentage) return

    const interval = setInterval(() => {
      progress += Math.random() * 15
      if (progress >= 95) {
        clearInterval(interval)
        progress = 100
      }

      progressBar.style.width = progress + "%"
      percentage.textContent = Math.round(progress) + "%"
    }, 200)
  }

  hideUploadProgress() {
    setTimeout(() => {
      this.uploadProgress.classList.add("hidden")
    }, 1000)
  }

  async loadServerStatus() {
    try {
      const response = await fetch("/api/status")
      const status = await response.json()
      this.serverIp.textContent = `http://${status.local_ip}:${status.config.port}`
      this.expiryTime.textContent = status.config.file_expiry_minutes
    } catch (error) {
      this.serverIp.textContent = "Connection Error"
      console.error("Status error:", error)
    }
  }

  async loadFiles() {
    console.log("Loading files...")
    this.showMainLoading("Refreshing files...")
    this.typeWriterMessage("Refreshing files...")
    
    try {
      const response = await fetch("/api/files")
      console.log("Files API response status:", response.status)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      console.log("Files loaded:", result)
      this.displayFiles(result.files)
      this.showToast("✅ Files refreshed", "File list updated", "success")
      this.typeWriterMessage("Files refreshed successfully!")
    } catch (error) {
      console.error("Load files error:", error)
      this.showToast("❌ Failed to load files", `Error: ${error.message}`, "error")
      this.typeWriterMessage("Failed to refresh files...")
    } finally {
    
      setTimeout(() => {
        this.hideMainLoading()
        this.hideFallbackLoading()
      }, 2500)
    }
  }

  displayFiles(files) {
    this.files.clear()
    this.filesGrid.innerHTML = ""

    files.forEach((file) => {
      this.files.set(file.id, file)
      this.addFileCard(file)
    })

    this.updateUI()
  }

  addFileCard(file) {
    if (this.files.has(file.id)) {
      // Update existing file
      this.files.set(file.id, file)
      const existingCard = document.querySelector(`[data-file-id="${file.id}"]`)
      if (existingCard) {
        this.updateFileCard(existingCard, file)
        return
      }
    }

    this.files.set(file.id, file)

    const template = document.getElementById("file-card-template")
    const card = template.content.cloneNode(true)
    const cardElement = card.querySelector(".file-card")

    cardElement.setAttribute("data-file-id", file.id)

    // Populate file information
    card.querySelector(".file-name").textContent = file.name
    card.querySelector(".file-size").textContent = this.formatFileSize(file.size)
    card.querySelector(".file-expiry").textContent = this.formatTimeRemaining(file.seconds_remaining)
    card.querySelector(".file-uploaded").textContent = `Uploaded: ${this.formatTime(file.uploaded_at)}`
    card.querySelector(".qr-code").src = `data:image/png;base64,${file.qr_code}`
    card.querySelector(".download-url").value = file.download_url

    // Add event listeners
    const copyBtn = card.querySelector(".copy-btn")
    const downloadBtn = card.querySelector(".download-btn")
    const deleteBtn = card.querySelector(".delete-btn")
    const qrToggleBtn = card.querySelector(".qr-toggle-btn")
    const qrSection = card.querySelector(".qr-section")
    const urlInput = card.querySelector(".download-url")

    copyBtn.addEventListener("click", () => this.copyToClipboard(urlInput.value, copyBtn))
    downloadBtn.addEventListener("click", () => window.open(file.download_url, "_blank"))
    deleteBtn.addEventListener("click", () => this.deleteFile(file.id))
    qrToggleBtn.addEventListener("click", () => this.toggleQRCode(qrSection, qrToggleBtn))

    this.filesGrid.appendChild(card)
    this.updateUI()
  }

  updateFileCard(cardElement, file) {
    cardElement.querySelector(".file-expiry").textContent = this.formatTimeRemaining(file.seconds_remaining)
  }

  removeFileCard(fileId) {
    this.files.delete(fileId)
    const card = document.querySelector(`[data-file-id="${fileId}"]`)
    if (card) {
      card.style.animation = "slide-up 0.3s ease-out reverse"
      setTimeout(() => card.remove(), 300)
    }
    this.updateUI()
  }

  toggleQRCode(qrSection, button) {
    const isHidden = qrSection.classList.contains("hidden")

    if (isHidden) {
      qrSection.classList.remove("hidden")
      qrSection.style.animation = "slide-up 0.3s ease-out"
      button.style.background = "#000"
      button.style.color = "#fff"
    } else {
      qrSection.style.animation = "slide-up 0.3s ease-out reverse"
      setTimeout(() => qrSection.classList.add("hidden"), 300)
      button.style.background = ""
      button.style.color = ""
    }
  }

  updateFileTimers() {
    this.files.forEach((file, fileId) => {
      if (file.seconds_remaining > 0) {
        file.seconds_remaining -= 1
        const card = document.querySelector(`[data-file-id="${fileId}"]`)
        if (card) {
          const expiryElement = card.querySelector(".file-expiry")
          expiryElement.textContent = this.formatTimeRemaining(file.seconds_remaining)

          // Change color as time runs out
          if (file.seconds_remaining < 300) {
            // Less than 5 minutes
            expiryElement.classList.add("text-red-600")
            expiryElement.classList.remove("text-orange-600")
          }
        }
      }
    })
  }

  async deleteFile(fileId) {
    try {
      const response = await fetch(`/api/delete/${fileId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete file")
      }

      // File will be removed via WebSocket message
      this.showToast("🗑️ File deleted", "File removed successfully")
    } catch (error) {
      this.showToast("❌ Delete failed", error.message)
    }
  }

  async clearAllFiles() {
    if (!confirm("Are you sure you want to delete all files?")) return

    const fileIds = Array.from(this.files.keys())

    for (const fileId of fileIds) {
      try {
        await fetch(`/api/delete/${fileId}`, { method: "DELETE" })
      } catch (error) {
        console.error(`Failed to delete file ${fileId}:`, error)
      }
    }
  }

  async copyToClipboard(text, button) {
    try {
      await navigator.clipboard.writeText(text)

      const originalContent = button.innerHTML
      button.innerHTML = `
        <svg class="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        Copied!
      `
      button.classList.add("loading")

      setTimeout(() => {
        button.innerHTML = originalContent
        button.classList.remove("loading")
      }, 2000)

      this.showToast("📋 Link copied", "Download link copied to clipboard")
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea")
      textArea.value = text
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)

      this.showToast("📋 Link copied", "Download link copied to clipboard")
    }
  }

  updateUI() {
    const fileCount = this.files.size
    this.fileCount.textContent = fileCount
    this.emptyState.style.display = fileCount > 0 ? "none" : "block"
    this.clearAllBtn.style.display = fileCount > 0 ? "block" : "none"
  }

  formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes"

    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  formatTimeRemaining(seconds) {
    if (seconds <= 0) return "Expired"

    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60

    if (minutes === 0) {
      return `${remainingSeconds}s remaining`
    } else if (minutes < 60) {
      return `${minutes}m ${remainingSeconds}s remaining`
    } else {
      const hours = Math.floor(minutes / 60)
      const remainingMinutes = minutes % 60
      return `${hours}h ${remainingMinutes}m remaining`
    }
  }

  formatTime(isoString) {
    const date = new Date(isoString)
    return date.toLocaleTimeString()
  }

  showToast(title, message = "", type = "info") {
    const template = document.getElementById("toast-template")
    const toast = template.content.cloneNode(true)

    const toastElement = toast.querySelector(".toast")
    const icon = toast.querySelector(".toast-icon")
    const titleElement = toast.querySelector(".toast-message")
    const messageElement = toast.querySelector(".toast-submessage")

    titleElement.textContent = title
    messageElement.textContent = message

    // Set icon and style based on type
    const config = {
      success: { icon: "✅", class: "bg-green-600" },
      error: { icon: "❌", class: "bg-red-600" },
      warning: { icon: "⚠️", class: "bg-yellow-600" },
      info: { icon: "ℹ️", class: "bg-blue-600" },
    }

    const { icon: iconText, class: bgClass } = config[type] || config.info
    icon.textContent = iconText
    toastElement.classList.add(bgClass)

    document.body.appendChild(toast)

    // Show toast
    setTimeout(() => toastElement.classList.add("show"), 100)

    // Hide toast after different durations based on type
    const durations = {
      success: 2000, // 2 seconds for success messages
      error: 4000,   // 4 seconds for errors
      warning: 3000, // 3 seconds for warnings
      info: 2500     // 2.5 seconds for info
    }
    
    const duration = durations[type] || durations.info
    
    setTimeout(() => {
      toastElement.classList.add("hide")
      setTimeout(() => toastElement.remove(), 300)
    }, duration)
  }
}

// Initialize the enhanced application
document.addEventListener("DOMContentLoaded", () => {
  new LANDropSpotEnhanced()
})
