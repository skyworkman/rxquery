const fs = require("fs")
const path = require("path")
const deleteFolderRecursive = function (directoryPath) {
  if (fs.existsSync(directoryPath)) {
    fs.readdirSync(directoryPath).forEach((file, index) => {
      const curPath = path.join(directoryPath, file)
      if (fs.lstatSync(curPath).isDirectory()) {
        // recurse
        deleteFolderRecursive(curPath)
      } else {
        // delete file
        fs.unlinkSync(curPath)
      }
    })
    fs.rmdirSync(directoryPath)
  }
}

function main() {
  deleteFolderRecursive("dist")
  // fs.mkdirSync("dist")
  // const source = fs.readFileSync(__dirname + "/package.json").toString("utf-8")
  // const sourceObj = JSON.parse(source)
  // sourceObj.files = undefined
  // sourceObj.scripts = {}
  // fs.writeFileSync(__dirname + "/dist/package.json", Buffer.from(JSON.stringify(sourceObj, null, 2), "utf-8"))
  // fs.copyFileSync(__dirname + "/.npmignore", __dirname + "/dist/.npmignore")
  // fs.copyFileSync(__dirname + "/.npmrc", __dirname + "/dist/.npmrc")
}

main()
