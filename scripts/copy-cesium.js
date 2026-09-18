const fs = require('fs');
const path = require('path');

function copyCesiumAssets() {
  const cesiumSource = path.join(__dirname, '..', 'node_modules', 'cesium', 'Build', 'Cesium');
  const cesiumDest = path.join(__dirname, '..', 'public', 'cesium');

  const directoriesToCopy = ['Assets', 'Widgets', 'Workers', 'ThirdParty'];

  if (!fs.existsSync(cesiumSource)) {
    console.warn('[copy-cesium] Warning: Cesium build source directory not found at', cesiumSource);
    return false;
  }

  if (!fs.existsSync(cesiumDest)) {
    fs.mkdirSync(cesiumDest, { recursive: true });
  }

  // Check if all directories already exist and are populated
  const allAlreadyExist = directoriesToCopy.every((dir) => {
    const p = path.join(cesiumDest, dir);
    return fs.existsSync(p) && fs.readdirSync(p).length > 0;
  });

  if (allAlreadyExist) {
    return true;
  }

  let allCopied = true;
  directoriesToCopy.forEach((dir) => {
    const src = path.join(cesiumSource, dir);
    const dest = path.join(cesiumDest, dir);
    if (fs.existsSync(src)) {
      fs.cpSync(src, dest, { recursive: true, force: true });
      console.log(`[copy-cesium] Copied Cesium ${dir} -> public/cesium/${dir}`);
    } else {
      console.warn(`[copy-cesium] Warning: Source dir missing: ${src}`);
      allCopied = false;
    }
  });


  return allCopied;
}

if (require.main === module) {
  copyCesiumAssets();
}

module.exports = { copyCesiumAssets };

