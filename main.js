const {app, BrowserWindow} = require('electron')

require('electron-debug')({enabled: true})

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win

function createWindow () {
  var path = require('path')
  var fs = require('fs')
  var initPath = path.join(app.getPath('userData'), 'init.json')
  var data = {}
  try {
    data = JSON.parse(fs.readFileSync(initPath, 'utf8'))
  } catch (e) {
    data.width = 800
    data.height = 600
    data.isMaximized = false
  }

  // Create the browser window.
  win = new BrowserWindow({
    name: 'squeeze-controller',
    width: data.width,
    height: data.height,
    minWidth: 800,
    minHeight: 600,
    toolbar: false
  })

  if (data.isMaximized) win.maximize()
  // Disable menu bar
  // win.setMenu(null)

  // and load the index.html of the app.
  win.loadURL(`file://${__dirname}/index.html`)

  // Uncomment to open the DevTools.
  // win.webContents.openDevTools()
  win.on('close', () => {
    var bounds = win.getBounds()
    var isMaximized = win.isMaximized()
    var data = {height: bounds.height, width: bounds.width, isMaximized: isMaximized}
    console.log(data)
    fs.writeFileSync(initPath, JSON.stringify(data))
  })

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (win === null) {
    createWindow()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
