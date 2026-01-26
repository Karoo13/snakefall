function unreachable() { return new Error("unreachable"); }
if (typeof VERSION === "undefined") {
  document.getElementById("versionSpan").innerHTML = "r.1.5";
}
var canvas = document.getElementById("canvas");

// tile codes
var SPACE = "0".charCodeAt(0);
var WALL = "1".charCodeAt(0);
var SPIKE = "2".charCodeAt(0);
var FRUIT_v0 = "3".charCodeAt(0); // legacy
var EXIT = "4".charCodeAt(0);
var PORTAL = "5".charCodeAt(0);
var PLATFORM = "6".charCodeAt(0); // legacy
var PLATFORMU = "u".charCodeAt(0);
var PLATFORMD = "d".charCodeAt(0);
var PLATFORML = "l".charCodeAt(0);
var PLATFORMR = "r".charCodeAt(0);
var WOODPLATFORM = "w".charCodeAt(0);
var FOAM = "f".charCodeAt(0);
var DIGGABLEDIRT = "t".charCodeAt(0);
var OPENGATE = "o".charCodeAt(0);
var CLOSEDGATE = "c".charCodeAt(0);
var validTileCodes = [SPACE, WALL, SPIKE, FRUIT, POISONFRUIT, EXIT, PORTAL, PLATFORM, PLATFORMU, PLATFORMD, PLATFORML, PLATFORMR, WOODPLATFORM, FOAM, DIGGABLEDIRT, OPENGATE, CLOSEDGATE];

// object types
var SNAKE = "s";
var BLOCK = "b";
var FRUIT = "f";
var POISONFRUIT = "p";

var tileSize = 30;
var level;
var unmoveStuff = {undoStack:[], redoStack:[], spanId:"movesSpan", undoButtonId:"unmoveButton", redoButtonId:"removeButton"};
var uneditStuff = {undoStack:[], redoStack:[], spanId:"editsSpan", undoButtonId:"uneditButton", redoButtonId:"reeditButton"};
var paradoxes = [];

var portalCollisionMap = {};
var portalsBlocked = false;

function loadLevel(newLevel) {
  level = newLevel;
  currentSerializedLevel = compressSerialization(stringifyLevel(newLevel));

  activateAnySnakePlease();
  unmoveStuff.undoStack = [];
  unmoveStuff.redoStack = [];
  undoStuffChanged(unmoveStuff);
  uneditStuff.undoStack = [];
  uneditStuff.redoStack = [];
  undoStuffChanged(uneditStuff);
  blockSupportRenderCache = {};
  render();
}


var magicNumber_v0 = "3tFRIoTU";
var magicNumber    = "HyRr4JK1";
var exampleLevel = magicNumber + "&" +
  "17&31" +
"?" +
  "0000000000000000000000000000000" +
  "0000000000000000000000040000000" +
  "0000000000000000000000000000000" +
  "00000000000000000000000o0000000" +
  "00000000000ddd000000000o0000000" +
  "00000uuuuuu00000000000000000000" +
  "0000000000000000000000000000000" +
  "0000000000000110000000000000000" +
  "0000000000000111100000000000000" +
  "0000000000000011000010000000000" +
  "000000000000001t000011000000000" +
  "0000000000000t1t10000t001000000" +
  "0000001111111ttt11000t011000000" +
  "000001111111111111111tt11ff0000" +
  "0000011111111101111111111ff0000" +
  "0000001111111100111111111f00000" +
  "0000001111111000111111111000000" +
"/" +
"b0 ?397&398/" +
"b6 ?392&361/" +
"s4 ?351&350&349/" +
"f2 ?163/" +
"f1 ?431/" +
"f0 ?328/";

var testLevel_v0 = "3tFRIoTU&5&5?0005*00300024005*001000/b0?7&6&15&23/s3?18/s0?1&0&5/s1?2/s4?10/s2?17/b2?9/b3?14/b4?19/b1?4&20/b5?24/";
var testLevel_v0_converted = "HyRr4JK1&5&5?0005*4024005*001000/b0?7&6&15&23/s3?18/s0?1&0&5/s1?2/s4?10/s2?17/b2?9/b3?14/b4?19/b1?4&20/b5?24/f0?8/";

function parseLevel(string) {
  // magic number
  var cursor = 0;
  skipWhitespace();
  var versionTag = string.substr(cursor, magicNumber.length);
  switch (versionTag) {
    case magicNumber_v0:
    case magicNumber: break;
    default: throw new Error("not a snakefall level");
  }
  cursor += magicNumber.length;
  consumeKeyword("&");

  var level = {
    height: -1,
    width: -1,
    map: [],
    objects: [],
  };

  // height, width
  level.height = readInt();
  consumeKeyword("&");
  level.width = readInt();

  // map
  var mapData = readRun();
  mapData = decompressSerialization(mapData);
  if (level.height * level.width !== mapData.length) throw parserError("height, width, and map.length do not jive");
  var upconvertedObjects = [];
  var fruitCount = 0;
  for (var i = 0; i < mapData.length; i++) {
    var tileCode = mapData[i].charCodeAt(0);
    if (tileCode === FRUIT_v0 && versionTag === magicNumber_v0) {
      // fruit used to be a tile code. now it's an object.
      upconvertedObjects.push({
        type: FRUIT,
        id: fruitCount++,
        dead: false, // unused
        locations: [i],
      });
      tileCode = SPACE;
    }
    if (validTileCodes.indexOf(tileCode) === -1) throw parserError("invalid tilecode: " + JSON.stringify(mapData[i]));
    level.map.push(tileCode);
  }

  // objects
  skipWhitespace();
  while (cursor < string.length) {
    var object = {
      type: "?",
      id: -1,
      dead: false,
      locations: [],
    };

    // type
    object.type = string[cursor];
    var locationsLimit;
    if      (object.type === SNAKE) locationsLimit = -1;
    else if (object.type === BLOCK) locationsLimit = -1;
    else if (object.type === FRUIT) locationsLimit = 1;
    else if (object.type === POISONFRUIT) locationsLimit = 1;
    else throw parserError("expected object type code");
    cursor += 1;

    // id
    object.id = readInt();

    // locations
    var locationsData = readRun();
    var locationStrings = locationsData.split("&");
    if (locationStrings.length === 0) throw parserError("locations must be non-empty");
    if (locationsLimit !== -1 && locationStrings.length > locationsLimit) throw parserError("too many locations");

    locationStrings.forEach(function(locationString) {
      var location = parseInt(locationString);
      if (!(0 <= location && location < level.map.length)) throw parserError("location out of bounds: " + JSON.stringify(locationString));
      object.locations.push(location);
    });

    level.objects.push(object);
    skipWhitespace();
  }
  for (var i = 0; i < upconvertedObjects.length; i++) {
    level.objects.push(upconvertedObjects[i]);
  }

  return level;

  function skipWhitespace() {
    while (" \n\t\r".indexOf(string[cursor]) !== -1) {
      cursor += 1;
    }
  }
  function consumeKeyword(keyword) {
    skipWhitespace();
    if (string.indexOf(keyword, cursor) !== cursor) throw parserError("expected " + JSON.stringify(keyword));
    cursor += 1;
  }
  function readInt() {
    skipWhitespace();
    for (var i = cursor; i < string.length; i++) {
      if ("0123456789".indexOf(string[i]) === -1) break;
    }
    var substring = string.substring(cursor, i);
    if (substring.length === 0) throw parserError("expected int");
    cursor = i;
    return parseInt(substring, 10);
  }
  function readRun() {
    consumeKeyword("?");
    var endIndex = string.indexOf("/", cursor);
    var substring = string.substring(cursor, endIndex);
    cursor = endIndex + 1;
    return substring;
  }
  function parserError(message) {
    return new Error("parse error at position " + cursor + ": " + message);
  }
}

function serializeTileCode(tileCode) {
  return String.fromCharCode(tileCode);
}

function stringifyLevel(level) {
  var output = magicNumber + "&";
  output += level.height + "&" + level.width + "\n";

  output += "?\n";
  for (var r = 0; r < level.height; r++) {
    output += "  " + level.map.slice(r * level.width, (r + 1) * level.width).map(serializeTileCode).join("") + "\n";
  }
  output += "/\n";

  output += serializeObjects(level.objects);

  // sanity check
  var shouldBeTheSame = parseLevel(output);
  if (!deepEquals(level, shouldBeTheSame)) throw unreachable(); // serialization/deserialization is broken

  return output;
}
function serializeObjects(objects) {
  var output = "";
  for (var i = 0; i < objects.length; i++) {
    var object = objects[i];
    output += object.type + object.id + " ";
    output += "?" + object.locations.join("&") + "/\n";
  }
  return output;
}
function serializeObjectState(object) {
  if (object == null) return [0,[]];
  return [object.dead, copyArray(object.locations)];
}

var base66 = "----0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
function compressSerialization(string) {
  string = string.replace(/\s+/g, "");
  // run-length encode several 0's in a row, etc.
  // 2000000000000003 -> 2*A03 ("A" is 14 in base66 defined above)
  var result = "";
  var runStart = 0;
  for (var i = 1; i < string.length + 1; i++) {
    var runLength = i - runStart;
    if (string[i] === string[runStart] && runLength < base66.length - 1) continue;
    // end of run
    if (runLength >= 4) {
      // compress
      result += "*" + base66[runLength] + string[runStart];
    } else {
      // literal
      result += string.substring(runStart, i);
    }
    runStart = i;
  }
  return result;
}
function decompressSerialization(string) {
  string = string.replace(/\s+/g, "");
  var result = "";
  for (var i = 0; i < string.length; i++) {
    if (string[i] === "*") {
      i += 1;
      var runLength = base66.indexOf(string[i]);
      i += 1;
      var char = string[i];
      for (var j = 0; j < runLength; j++) {
        result += char;
      }
    } else {
      result += string[i];
    }
  }
  return result;
}

var replayMagicNumber = "nmGTi8PB";
function stringifyReplay() {
  var output = replayMagicNumber + "&";
  // only specify the snake id in an input if it's different from the previous.
  // the first snake index is 0 to optimize for the single-snake case.
  var currentSnakeId = 0;
  for (var i = 0; i < unmoveStuff.undoStack.length; i++) {
    var firstChange = unmoveStuff.undoStack[i][0];
    if (firstChange[0] !== "i") throw unreachable();
    var snakeId = firstChange[1];
    var dr = firstChange[2];
    var dc = firstChange[3];
    var directionCode;
    if      (dr ===-1 && dc === 0) directionCode = "u";
    else if (dr === 0 && dc ===-1) directionCode = "l";
    else if (dr === 1 && dc === 0) directionCode = "d";
    else if (dr === 0 && dc === 1) directionCode = "r";
    else throw unreachable();
    if (snakeId !== currentSnakeId) {
      output += snakeId; // int to string
      currentSnakeId = snakeId;
    }
    output += directionCode;
  }
  return output;
}
function parseAndLoadReplay(string) {
  string = decompressSerialization(string);
  var expectedPrefix = replayMagicNumber + "&";
  if (string.substring(0, expectedPrefix.length) !== expectedPrefix) throw new Error("unrecognized replay string");
  var cursor = expectedPrefix.length;

  // the starting snakeid is 0, which may not exist, but we only validate it when doing a move.
  activeSnakeId = 0;
  while (cursor < string.length) {
    var snakeIdStr = "";
    var c = string.charAt(cursor);
    cursor += 1;
    while ('0' <= c && c <= '9') {
      snakeIdStr += c;
      if (cursor >= string.length) throw new Error("replay string has unexpected end of input");
      c = string.charAt(cursor);
      cursor += 1;
    }
    if (snakeIdStr.length > 0) {
      activeSnakeId = parseInt(snakeIdStr);
      // don't just validate when switching snakes, but on every move.
    }

    // doing a move.
    if (!getSnakes().some(function(snake) {
      return snake.id === activeSnakeId;
    })) {
      throw new Error("invalid snake id: " + activeSnakeId);
    }
    switch (c) {
      case 'l': move( 0, -1); break;
      case 'u': move(-1,  0); break;
      case 'r': move( 0,  1); break;
      case 'd': move( 1,  0); break;
      default: throw new Error("replay string has invalid direction: " + c);
    }
  }

  // now that the replay was executed successfully, undo it all so that it's available in the redo buffer.
  reset(unmoveStuff);
  document.getElementById("removeButton").style.fontWeight = "bold";
}

var currentSerializedLevel;
function saveLevel() {
  if (isDead()) return alert("Can't save while you're dead!");
  var serializedLevel = compressSerialization(stringifyLevel(level));
  currentSerializedLevel = serializedLevel;
  var hash = "#level=" + serializedLevel;
  expectHash = hash;
  location.hash = hash;

  // This marks a starting point for solving the level.
  unmoveStuff.undoStack = [];
  unmoveStuff.redoStack = [];
  editorHasBeenTouched = false;
  undoStuffChanged(unmoveStuff);
}

function saveReplay() {
  if (dirtyState === EDITOR_DIRTY) return alert("Can't save a replay with unsaved editor changes.");
  // preserve the level in the url bar.
  var hash = "#level=" + currentSerializedLevel;
  if (dirtyState === REPLAY_DIRTY) {
    // there is a replay to save
    hash += "#replay=" + compressSerialization(stringifyReplay());
    saveProgressButton.textContent = "Progress Saved";
  }
  expectHash = hash;
  location.hash = hash;
}

function deepEquals(a, b) {
  if (a == null) return b == null;
  if (typeof a === "string" || typeof a === "number" || typeof a === "boolean") return a === b;
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (!deepEquals(a[i], b[i])) return false;
    }
    return true;
  }
  // must be objects
  var aKeys = Object.keys(a);
  var bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  aKeys.sort();
  bKeys.sort();
  if (!deepEquals(aKeys, bKeys)) return false;
  for (var i = 0; i < aKeys.length; i++) {
    if (!deepEquals(a[aKeys[i]], b[bKeys[i]])) return false;
  }
  return true;
}

function getLocation(level, r, c) {
  if (!isInBounds(level, r, c)) throw unreachable();
  return r * level.width + c;
}
function getRowcol(level, location) {
  if (location < 0 || location >= level.width * level.height) throw unreachable();
  var r = Math.floor(location / level.width);
  var c = location % level.width;
  return {r:r, c:c};
}
function isInBounds(level, r, c) {
  if (c < 0 || c >= level.width) return false;;
  if (r < 0 || r >= level.height) return false;;
  return true;
}
function offsetLocation(location, dr, dc) {
  var rowcol = getRowcol(level, location);
  return getLocation(level, rowcol.r + dr, rowcol.c + dc);
}

var SHIFT = 1;
var CTRL = 2;
var ALT = 4;
document.addEventListener("keydown", function(event) {
  var modifierMask = (
    (event.shiftKey ? SHIFT : 0) |
    (event.ctrlKey ? CTRL : 0) |
    (event.altKey ? ALT : 0)
  );
  switch (event.code) {
    case "ArrowLeft":
      if (modifierMask === 0) { move(0, -1); break; }
      return;
    case "ArrowUp":
      if (modifierMask === 0) { move(-1, 0); break; }
      return;
    case "ArrowRight":
      if (modifierMask === 0) { move(0, 1); break; }
      return;
    case "ArrowDown":
      if (modifierMask === 0) { move(1, 0); break; }
      return;
    case "Backspace":
      if (modifierMask === 0)     { undo(unmoveStuff); break; }
      if (modifierMask === SHIFT) { redo(unmoveStuff); break; }
      return;
    case "KeyQ":
      if (modifierMask === 0)     { undo(unmoveStuff); break; }
      if (modifierMask === SHIFT) { redo(unmoveStuff); break; }
      return;
    case "KeyZ":
      if (modifierMask === 0)     { undo(unmoveStuff); break; }
      if (modifierMask === SHIFT) { redo(unmoveStuff); break; }
      if ( persistentState.showEditor && modifierMask === CTRL)        { undo(uneditStuff); break; }
      if ( persistentState.showEditor && modifierMask === CTRL+SHIFT)  { redo(uneditStuff); break; }
      return;
    case "KeyY":
      if (modifierMask === 0)     { redo(unmoveStuff); break; }
      if ( persistentState.showEditor && modifierMask === CTRL)  { redo(uneditStuff); break; }
      return;
    case "KeyR":
      if (modifierMask === 0)     { reset(unmoveStuff); break; }
      if (modifierMask === SHIFT) { unreset(unmoveStuff); break; }
      return;
    case 'KeyE':
      if (modifierMask === SHIFT) { toggleShowEditor(); break; }
      if (!persistentState.showEditor && modifierMask === 0) { redo(unmoveStuff); break; }
      if ( persistentState.showEditor && modifierMask === 0) { setPaintBrushTileCode(SPACE); break; }
      return;
    case "Delete":
      if ( persistentState.showEditor && modifierMask === 0) { setPaintBrushTileCode(SPACE); break; }
      return;
    case "KeyW":
      if (!persistentState.showEditor && modifierMask === 0) { move(-1, 0); break; }
      if ( persistentState.showEditor && modifierMask === 0) { setPaintBrushTileCode(WALL); break; }
      return;
    case "KeyA":
      if (!persistentState.showEditor && modifierMask === 0)     { move(0, -1); break; }
      if ( persistentState.showEditor && modifierMask === 0)     { setPaintBrushTileCode("resizeU"); break; }
      if ( persistentState.showEditor && modifierMask === SHIFT) { setPaintBrushTileCode("resizeD"); break; }
      if ( persistentState.showEditor && modifierMask === CTRL)  { selectAll(); break; }
      return;
    case "KeyS":
      if (!persistentState.showEditor && modifierMask === 0)     { move(1, 0); break; }
      if ( persistentState.showEditor && modifierMask === 0)     { setPaintBrushTileCode(SPIKE); break; }
      if ( persistentState.showEditor && modifierMask === SHIFT) { setPaintBrushTileCode("select"); break; }
      if ( persistentState.showEditor && modifierMask === CTRL+SHIFT) { saveLevel(); break; }
      if (modifierMask === CTRL) { saveReplay(); break; }
      return;
    case "KeyD":
      if (!persistentState.showEditor && modifierMask === 0)     { move(0, 1); break; }
      if ( persistentState.showEditor && modifierMask === 0)     { setPaintBrushTileCode(DIGGABLEDIRT); break; }
      if ( persistentState.showEditor && modifierMask === SHIFT) { setPaintBrushTileCode(FOAM); break; }
      return;
    case "KeyX":
      if ( persistentState.showEditor && modifierMask === 0) { setPaintBrushTileCode(EXIT); break; }
      if ( persistentState.showEditor && modifierMask === CTRL) { cutSelection(); break; }
      return;
    case "KeyF":
      if ( persistentState.showEditor && modifierMask === 0)     { setPaintBrushTileCode(FRUIT); break; }
      if ( persistentState.showEditor && modifierMask === SHIFT) { setPaintBrushTileCode(POISONFRUIT); break; }
      return;
    case "KeyP":
      if ( persistentState.showEditor && modifierMask === 0) { setPaintBrushTileCode(PORTAL); break; }
      return;
    case "KeyN":
      if ( persistentState.showEditor && modifierMask === 0) { setPaintBrushTileCode(SNAKE); break; }
      return;
    case "KeyB":
      if ( persistentState.showEditor && modifierMask === 0) { setPaintBrushTileCode(BLOCK); break; }
      return;
    case "KeyU":
      if ( persistentState.showEditor && modifierMask === 0)     { setPaintBrushTileCode(PLATFORMU); break; }
      if ( persistentState.showEditor && modifierMask === SHIFT) { setPaintBrushTileCode(WOODPLATFORM); break; }
      return;
    case "KeyH":
      if ( persistentState.showEditor && modifierMask === 0) { setPaintBrushTileCode(PLATFORML); break; }
      return;
    case "KeyJ":
      if ( persistentState.showEditor && modifierMask === 0) { setPaintBrushTileCode(PLATFORMD); break; }
      return;
    case "KeyK":
      if ( persistentState.showEditor && modifierMask === 0) { setPaintBrushTileCode(PLATFORMR); break; }
      return;
    case "KeyO":
      if ( persistentState.showEditor && modifierMask === 0)     { setPaintBrushTileCode(OPENGATE); break; }
      if ( persistentState.showEditor && modifierMask === SHIFT) { setPaintBrushTileCode(CLOSEDGATE); break; }
      return;
    case "KeyC":
      if ( persistentState.showEditor && modifierMask === SHIFT) { toggleCollision(); break; }
      if ( persistentState.showEditor && modifierMask === CTRL)  { copySelection();   break; }
      return;
    case "KeyG":
      if (modifierMask === 0) { toggleGrid(); break; }
      if ( persistentState.showEditor && modifierMask === SHIFT) { toggleGravity(); break; }
      return;
    case "KeyV":
      if ( persistentState.showEditor && modifierMask === CTRL) { setPaintBrushTileCode("paste"); break; }
      return;
    case "Escape":
      if ( persistentState.showEditor && modifierMask === 0) { setPaintBrushTileCode(null); break; }
      return;
    case "Space":
    case "Tab":
      if (modifierMask === 0)     { switchSnakes( 1); break; }
      if (modifierMask === SHIFT) { switchSnakes(-1); break; }
      return;
    case "Digit1":
    case "Digit2":
    case "Digit3":
    case "Digit4":
    case "Digit5":
    case "Digit6":
    case "Digit7":
    case "Digit8":
    case "Digit9":
      if (modifierMask !== 0) return;
      if (!isAlive()) return;
      var index = event.key.slice(-1) - 1;
      var snakes = getSnakes();
      snakes.sort(compareId);
      activeSnakeId = snakes[index % snakes.length].id;
      break;
    default: return;
  }
  event.preventDefault();
  render();
});

document.getElementById("switchSnakesButton").addEventListener("click", function() {
  switchSnakes(1);
  render();
});
function switchSnakes(delta) {
  portalCollisionMap = {};
  portalsBlocked = false;
  if (!isAlive()) return;
  var snakes = getSnakes();
  snakes.sort(compareId);
  for (var i = 0; i < snakes.length; i++) {
    if (snakes[i].id === activeSnakeId) {
      activeSnakeId = snakes[(i + delta + snakes.length) % snakes.length].id;
      return;
    }
  }
  activeSnakeId = snakes[0].id;
}
document.getElementById("toggleDarkLight").addEventListener("click", function() {
  toggleDarkLight();
});
document.getElementById("showGridButton").addEventListener("click", function() {
  toggleGrid();
});
document.getElementById("saveProgressButton").addEventListener("click", function() {
  saveReplay();
});
document.getElementById("restartButton").addEventListener("click", function() {
  if (unmoveStuff.undoStack.length === 0 && unmoveStuff.redoStack.length > 0) {
    unreset(unmoveStuff);
  } else {
    reset(unmoveStuff);
  }
  render();
});
document.getElementById("unmoveButton").addEventListener("click", function() {
  undo(unmoveStuff);
  render();
});
document.getElementById("removeButton").addEventListener("click", function() {
  redo(unmoveStuff);
  render();
});

document.getElementById("showHideEditor").addEventListener("click", function() {
  toggleShowEditor();
});
function toggleShowEditor() {
  persistentState.showEditor = !persistentState.showEditor;
  savePersistentState();
  showEditorChanged();
}
function toggleDarkLight() {
  if (document.getElementById("toggleDarkLight").textContent === "Light") {
    document.documentElement.dataset.theme = "light";
    document.getElementById("toggleDarkLight").textContent = "Dark";
  } else {
    document.documentElement.dataset.theme = "dark";
    document.getElementById("toggleDarkLight").textContent = "Light";
  }
}
function toggleGrid() {
  persistentState.showGrid = !persistentState.showGrid;
  savePersistentState();
  render();
}
["serializationTextarea", "shareLinkTextbox"].forEach(function(id) {
  document.getElementById(id).addEventListener("keydown", function(event) {
    // let things work normally
    event.stopPropagation();
  });
});
document.getElementById("submitSerializationButton").addEventListener("click", function() {
  var string = document.getElementById("serializationTextarea").value;
  try {
    var newLevel = parseLevel(string);
  } catch (e) {
    alert(e);
    return;
  }
  loadLevel(newLevel);
});
document.getElementById("shareLinkTextbox").addEventListener("focus", function() {
  setTimeout(function() {
    document.getElementById("shareLinkTextbox").select();
  }, 0);
});

var paintBrushTileCode = null;
var paintBrushSnakeColorIndex = 0;
var paintBrushBlockId = 0;
var paintBrushObject = null;
var selectionStart = null;
var selectionEnd = null;
var resizeDragAnchorRowcol = null;
var clipboardData = null;
var clipboardOffsetRowcol = null;
var paintButtonIdAndTileCodes = [
  ["resizeUButton", "resizeU"],
  ["resizeDButton", "resizeD"],
  ["selectButton", "select"],
  ["pasteButton", "paste"],
  ["paintSpaceButton", SPACE],
  ["paintWallButton",  WALL],
  ["paintSpikeButton", SPIKE],
  ["paintExitButton", EXIT],
  ["paintFruitButton", FRUIT],
  ["paintPoisonFruitButton", POISONFRUIT],
  ["paintPortalButton", PORTAL],
  //["paintPlatformButton", PLATFORM],
  ["paintPlatformUButton", PLATFORMU],
  ["paintPlatformDButton", PLATFORMD],
  ["paintPlatformLButton", PLATFORML],
  ["paintPlatformRButton", PLATFORMR],
  ["paintWoodPlatformButton", WOODPLATFORM],
  ["paintFoamButton", FOAM],
  ["paintDiggableDirtButton", DIGGABLEDIRT],
  ["paintOpenGateButton", OPENGATE],
  ["paintClosedGateButton", CLOSEDGATE],
  ["paintSnakeButton", SNAKE],
  ["paintBlockButton", BLOCK],
];
paintButtonIdAndTileCodes.forEach(function(pair) {
  var id = pair[0];
  var tileCode = pair[1];
  document.getElementById(id).addEventListener("click", function() {
    setPaintBrushTileCode(tileCode);
  });
});
document.getElementById("uneditButton").addEventListener("click", function() {
  undo(uneditStuff);
  render();
});
document.getElementById("reeditButton").addEventListener("click", function() {
  redo(uneditStuff);
  render();
});
document.getElementById("saveLevelButton").addEventListener("click", function() {
  saveLevel();
});
document.getElementById("selectAllButton").addEventListener("click", function() {
  selectAll();
});
document.getElementById("copyButton").addEventListener("click", function() {
  copySelection();
});
document.getElementById("cutButton").addEventListener("click", function() {
  cutSelection();
});
document.getElementById("cheatGravityButton").addEventListener("click", function() {
  toggleGravity();
});
document.getElementById("cheatCollisionButton").addEventListener("click", function() {
  toggleCollision();
});
function toggleGravity() {
  isGravityEnabled = !isGravityEnabled;
  isCollisionEnabled = true;
  refreshCheatButtonText();
}
function toggleCollision() {
  isCollisionEnabled = !isCollisionEnabled;
  isGravityEnabled = false;
  refreshCheatButtonText();
}
function refreshCheatButtonText() {
  document.getElementById("cheatGravityButton").textContent = isGravityEnabled ? "Gravity: ON" : "Gravity: OFF";
  document.getElementById("cheatGravityButton").style.background = isGravityEnabled ? "" : "#f88";

  document.getElementById("cheatCollisionButton").textContent = isCollisionEnabled ? "Collision: ON" : "Collision: OFF";
  document.getElementById("cheatCollisionButton").style.background = isCollisionEnabled ? "" : "#f88";
}

// be careful with location vs rowcol, because this variable is used when resizing
var lastDraggingRowcol = null;
var hoverLocation = null;
var draggingChangeLog = null;
canvas.addEventListener("pointerdown", function(event) {
  if (!event.isPrimary) return;
  if (event.altKey) return;
  if (event.button !== 0) return;
  event.preventDefault();
  var location = getLocationFromEvent(event);
  if (persistentState.showEditor && paintBrushTileCode != null) {
    // editor tool
    lastDraggingRowcol = getRowcol(level, location);
    if (paintBrushTileCode === "select") selectionStart = location;
    if (paintBrushTileCode === "resizeU") resizeDragAnchorRowcol = lastDraggingRowcol;
    if (paintBrushTileCode === "resizeD") resizeDragAnchorRowcol = lastDraggingRowcol;
    draggingChangeLog = [];
    paintAtLocation(location, draggingChangeLog);
  } else {
    // playtime
    var object = findObjectAtLocation(location);
    if (object == null) return;
    if (object.type !== SNAKE) return;
    // active snake
    activeSnakeId = object.id;
    render();
  }
});
/*canvas.addEventListener("dblclick", function(event) {
  if (event.altKey) return;
  if (event.button !== 0) return;
  event.preventDefault();
  if (persistentState.showEditor && paintBrushTileCode === "select") {
    // double click with select tool
    var location = getLocationFromEvent(event);
    var object = findObjectAtLocation(location);
    if (object == null) return;
    stopDragging();
    if (object.type === SNAKE) {
      // edit snakes of this color
      paintBrushTileCode = SNAKE;
      paintBrushSnakeColorIndex = object.id % snakeColors.length;
    } else if (object.type === BLOCK) {
      // edit this particular block
      paintBrushTileCode = BLOCK;
      paintBrushBlockId = object.id;
    } else if (object.type === FRUIT) {
      // edit fruits, i guess
      paintBrushTileCode = FRUIT;
    } else throw unreachable();
    paintBrushTileCodeChanged();
  }
});*/
document.addEventListener("pointerup", function(event) {
  stopDragging();
});
document.addEventListener("pointercancel", function(event) {
  stopDragging();
});
function stopDragging() {
  if (lastDraggingRowcol != null) {
    // release the draggin'
    lastDraggingRowcol = null;
    paintBrushObject = null;
    resizeDragAnchorRowcol = null;
    pushUndo(uneditStuff, draggingChangeLog);
    draggingChangeLog = null;
  }
}
function clampRowcol(rowcol) {
  rowcol.r = clamp(rowcol.r, 0, level.height - 1);
  rowcol.c = clamp(rowcol.c, 0, level.width - 1);
  return rowcol;
}
canvas.addEventListener("pointermove", function(event) {
  if (!event.isPrimary) return;
  if (!persistentState.showEditor) return;
  var location = getLocationFromEvent(event);
  var mouseRowcol = getRowcol(level, location);
  if (lastDraggingRowcol != null) {
    clampRowcol(lastDraggingRowcol);
    // Dragging Force - Through the Fruit and Flames
    var lastDraggingLocation = getLocation(level, lastDraggingRowcol.r, lastDraggingRowcol.c);
    // we need to get rowcols for everything before we start dragging, because dragging might resize the world.
    var path = getNaiveOrthogonalPath(lastDraggingLocation, location).map(function(location) {
      return getRowcol(level, location);
    });
    path.forEach(function(rowcol) {
      clampRowcol(rowcol);
      // convert to location at the last minute in case each of these steps is changing the coordinate system.
      paintAtLocation(getLocation(level, rowcol.r, rowcol.c), draggingChangeLog);
    });
    lastDraggingRowcol = mouseRowcol;
    hoverLocation = null;
  } else {
    // hovering
    if (hoverLocation !== location) {
      hoverLocation = location;
      render();
    }
  }
});
canvas.addEventListener("pointerout", function() {
  if (hoverLocation !== location) {
    // turn off the hover when the mouse leaves
    hoverLocation = null;
    render();
  }
});
function getLocationFromEvent(event) {
  var r = Math.floor(eventToMouseY(event, canvas) / tileSize);
  var c = Math.floor(eventToMouseX(event, canvas) / tileSize);
  // since the canvas is centered, the bounding client rect can be half-pixel aligned,
  // resulting in slightly out-of-bounds mouse events.
  r = clamp(r, 0, level.height - 1);
  c = clamp(c, 0, level.width - 1);
  return getLocation(level, r, c);
}
function eventToMouseX(event, canvas) { return event.clientX - canvas.getBoundingClientRect().left; }
function eventToMouseY(event, canvas) { return event.clientY - canvas.getBoundingClientRect().top; }

function selectAll() {
  selectionStart = 0;
  selectionEnd = level.map.length - 1;
  setPaintBrushTileCode("select");
}

function setPaintBrushTileCode(tileCode) {
  if (tileCode === "paste") {
    // make sure we have something to paste
    if (clipboardData == null) return;
  }
  if (paintBrushTileCode === "select" && tileCode !== "select" && selectionStart != null && selectionEnd != null) {
    // usually this means to fill in the selection
    if (tileCode == null) {
      // cancel selection
      selectionStart = null;
      selectionEnd = null;
      return;
    }
    if (typeof tileCode === "number" && tileCode !== PORTAL) {
      // fill in the selection
      fillSelection(tileCode);
      selectionStart = null;
      selectionEnd = null;
      return;
    }
    // ok, just select something else then.
    selectionStart = null;
    selectionEnd = null;
  }
  if (tileCode === SNAKE) {
    if (paintBrushTileCode === SNAKE) {
      // next snake color
      paintBrushSnakeColorIndex = (paintBrushSnakeColorIndex + 1) % snakeColors.length;
    }
  } else if (tileCode === BLOCK) {
    var blocks = getBlocks();
    if (paintBrushTileCode === BLOCK && blocks.length > 0) {
      // cycle through block ids
      blocks.sort(compareId);
      if (paintBrushBlockId != null) {
        (function() {
          for (var i = 0; i < blocks.length; i++) {
            if (blocks[i].id === paintBrushBlockId) {
              i += 1;
              if (i < blocks.length) {
                // next block id
                paintBrushBlockId = blocks[i].id;
              } else {
                // new block id
                paintBrushBlockId = null;
              }
              return;
            }
          }
          throw unreachable()
        })();
      } else {
        // first one
        paintBrushBlockId = blocks[0].id;
      }
    } else {
      // new block id
      paintBrushBlockId = null;
    }
  } else if (tileCode == null) {
    // escape
    if (paintBrushTileCode === BLOCK && paintBrushBlockId != null) {
      // stop editing this block, but keep the block brush selected
      tileCode = BLOCK;
      paintBrushBlockId = null;
    }
  }
  paintBrushTileCode = tileCode;
  paintBrushTileCodeChanged();
}
function paintBrushTileCodeChanged() {
  paintButtonIdAndTileCodes.forEach(function(pair) {
    var id = pair[0];
    var tileCode = pair[1];
    var backgroundStyle = "";
    if (tileCode === paintBrushTileCode) {
      if (tileCode === SNAKE) {
        // show the color of the active snake in the color of the button
        backgroundStyle = snakeColors[paintBrushSnakeColorIndex];
      } else {
        backgroundStyle = "#ff0";
      }
    }
    document.getElementById(id).style.background = backgroundStyle;
  });

  var isSelectionMode = paintBrushTileCode === "select";
  ["cutButton", "copyButton"].forEach(function (id) {
    document.getElementById(id).disabled = !isSelectionMode;
  });
  document.getElementById("pasteButton").disabled = clipboardData == null;

  render();
}

function cutSelection() {
  copySelection();
  fillSelection(SPACE);
  render();
}
function copySelection() {
  var selectedLocations = getSelectedLocations();
  if (selectedLocations.length === 0) return;
  var selectedObjects = [];
  selectedLocations.forEach(function(location) {
    var object = findObjectAtLocation(location);
    if (object != null) addIfNotPresent(selectedObjects, object);
  });
  setClipboardData({
    level: JSON.parse(JSON.stringify(level)),
    selectedLocations: selectedLocations,
    selectedObjects: JSON.parse(JSON.stringify(selectedObjects)),
  });
}
function setClipboardData(data) {
  // find the center
  var minR = Infinity;
  var maxR = -Infinity;
  var minC = Infinity;
  var maxC = -Infinity;
  data.selectedLocations.forEach(function(location) {
    var rowcol = getRowcol(data.level, location);
    if (rowcol.r < minR) minR = rowcol.r;
    if (rowcol.r > maxR) maxR = rowcol.r;
    if (rowcol.c < minC) minC = rowcol.c;
    if (rowcol.c > maxC) maxC = rowcol.c;
  });
  var offsetR = Math.floor((minR + maxR) / 2);
  var offsetC = Math.floor((minC + maxC) / 2);

  clipboardData = data;
  clipboardOffsetRowcol = {r:offsetR, c:offsetC};
  paintBrushTileCodeChanged();
}
function fillSelection(tileCode) {
  var changeLog = [];
  var locations = getSelectedLocations();
  locations.forEach(function(location) {
    if (level.map[location] !== tileCode) {
      changeLog.push(["m", location, level.map[location], tileCode]);
      level.map[location] = tileCode;
    }
    removeAnyObjectAtLocation(location, changeLog);
  });
  pushUndo(uneditStuff, changeLog);
}
function getSelectedLocations() {
  if (selectionStart == null || selectionEnd == null) return [];
  var rowcol1 = getRowcol(level, selectionStart);
  var rowcol2 = getRowcol(level, selectionEnd);
  var r1 = rowcol1.r;
  var c1 = rowcol1.c;
  var r2 = rowcol2.r;
  var c2 = rowcol2.c;
  if (r2 < r1) {
    var tmp = r1;
    r1 = r2;
    r2 = tmp;
  }
  if (c2 < c1) {
    var tmp = c1;
    c1 = c2;
    c2 = tmp;
  }
  var objects = [];
  var locations = [];
  for (var r = r1; r <= r2; r++) {
    for (var c = c1; c <= c2; c++) {
      var location = getLocation(level, r, c);
      locations.push(location);
      var object = findObjectAtLocation(location);
      if (object != null) addIfNotPresent(objects, object);
    }
  }
  // select the rest of any partially-selected objects
  objects.forEach(function(object) {
    object.locations.forEach(function(location) {
      addIfNotPresent(locations, location);
    });
  });
  return locations;
}

function setHeight(newHeight, changeLog) {
  if (newHeight < level.height) {
    // crop
    for (var r = newHeight; r < level.height; r++) {
      for (var c = 0; c < level.width; c++) {
        var location = getLocation(level, r, c);
        removeAnyObjectAtLocation(location, changeLog);
        // also delete non-space tiles
        paintTileAtLocation(location, SPACE, changeLog);
      }
    }
    level.map.splice(newHeight * level.width);
  } else {
    // expand
    for (var r = level.height; r < newHeight; r++) {
      for (var c = 0; c < level.width; c++) {
        level.map.push(SPACE);
      }
    }
  }
  changeLog.push(["h", level.height, newHeight]);
  level.height = newHeight;
}
function setTop(newHeight, changeLog) {
  if (newHeight < level.height) {
    // crop
    for (var r = 0; r < level.height - newHeight; r++) {
      for (var c = 0; c < level.width; c++) {
        var location = getLocation(level, r, c);
        removeAnyObjectAtLocation(location, changeLog);
        // also delete non-space tiles
        paintTileAtLocation(location, SPACE, changeLog);
      }
    }
    level.map.splice(0, (level.height - newHeight) * level.width);
  } else {
    // expand
    for (var r = level.height; r < newHeight; r++) {
      for (var c = 0; c < level.width; c++) {
        // inefficient
        level.map.splice(0, 0, SPACE);
      }
    }
  }
  var transformLocation = function(location) {return location + (newHeight - level.height) * level.width};
  level.objects.forEach(function(object) {
    object.locations = object.locations.map(transformLocation);
  });
  changeLog.push(["t", level.height, newHeight]);
  level.height = newHeight;
}
function setWidth(newWidth, changeLog) {
  if (newWidth < level.width) {
    // crop
    for (var r = level.height - 1; r >= 0; r--) {
      for (var c = level.width - 1; c >= newWidth; c--) {
        var location = getLocation(level, r, c);
        removeAnyObjectAtLocation(location, changeLog);
        paintTileAtLocation(location, SPACE, changeLog);
        level.map.splice(location, 1);
      }
    }
  } else {
    // expand
    for (var r = level.height - 1; r >= 0; r--) {
      var insertionPoint = level.width * (r + 1);
      for (var c = level.width; c < newWidth; c++) {
        // boy is this inefficient. ... YOLO!
        level.map.splice(insertionPoint, 0, SPACE);
      }
    }
  }
  var transformLocation = makeScaleCoordinatesFunction(level.width, newWidth, 0);
  level.objects.forEach(function(object) {
    object.locations = object.locations.map(transformLocation);
  });
  changeLog.push(["w", level.width, newWidth]);
  level.width = newWidth;
}
function setLeft(newWidth, changeLog) {
  if (newWidth < level.width) {
    // crop
    for (var r = level.height - 1; r >= 0; r--) {
      for (var c = level.width - 1 - newWidth; c >= 0; c--) {
        var location = getLocation(level, r, c);
        removeAnyObjectAtLocation(location, changeLog);
        paintTileAtLocation(location, SPACE, changeLog);
        level.map.splice(location, 1);
      }
    }
  } else {
    // expand
    for (var r = level.height - 1; r >= 0; r--) {
      var insertionPoint = level.width * r;
      for (var c = level.width; c < newWidth; c++) {
        // boy is this inefficient. ... YOLO!
        level.map.splice(insertionPoint, 0, SPACE);
      }
    }
  }
  var offset = newWidth - level.width;
  var transformLocation = makeScaleCoordinatesFunction(level.width, newWidth, offset);
  level.objects.forEach(function(object) {
    object.locations = object.locations.map(transformLocation);
  });
  changeLog.push(["l", level.width, newWidth]);
  level.width = newWidth;
}

function newSnake(color, location) {
  var snakes = findSnakesOfColor(color);
  snakes.sort(compareId);
  for (var i = 0; i < snakes.length; i++) {
    if (snakes[i].id !== i * snakeColors.length + color) break;
  }
  return {
    type: SNAKE,
    id: i * snakeColors.length + color,
    dead: false,
    locations: [location],
  };
}
function newBlock(location) {
  var blocks = getBlocks();
  blocks.sort(compareId);
  for (var i = 0; i < blocks.length; i++) {
    if (blocks[i].id !== i) break;
  }
  return {
    type: BLOCK,
    id: i,
    dead: false, // unused
    locations: [location],
  };
}
function newFruit(location) {
  var fruits = getObjectsOfType(FRUIT);
  fruits.sort(compareId);
  for (var i = 0; i < fruits.length; i++) {
    if (fruits[i].id !== i) break;
  }
  return {
    type: FRUIT,
    id: i,
    dead: false, // unused
    locations: [location],
  };
}
function newPoisonFruit(location) {
  var fruits = getObjectsOfType(POISONFRUIT);
  fruits.sort(compareId);
  for (var i = 0; i < fruits.length; i++) {
    if (fruits[i].id !== i) break;
  }
  return {
    type: POISONFRUIT,
    id: i,
    dead: false, // unused
    locations: [location],
  };
}
function paintAtLocation(location, changeLog) {
  if (isDead()){
    // can't edit while dead
  } else if (typeof paintBrushTileCode === "number") {
    removeAnyObjectAtLocation(location, changeLog);
    paintTileAtLocation(location, paintBrushTileCode, changeLog);
  } else if (paintBrushTileCode === "resizeU") {
    var toRowcol = getRowcol(level, location);
    if (resizeDragAnchorRowcol == null) {
      resizeDragAnchorRowcol = toRowcol;
      return;
    }
    var dr = toRowcol.r - resizeDragAnchorRowcol.r;
    var dc = toRowcol.c - resizeDragAnchorRowcol.c;
    if (dr === 0 && dc === 0) return;
    if (dr < 0) setTop(level.height - dr, changeLog);
    if (dc < 0) setLeft(level.width - dc, changeLog);
    if (dr > 0) setHeight(level.height + dr, changeLog);
    if (dc > 0) setWidth(level.width + dc, changeLog);
    resizeDragAnchorRowcol = null;
  } else if (paintBrushTileCode === "resizeD") {
    var toRowcol = getRowcol(level, location);
    if (resizeDragAnchorRowcol == null) {
      resizeDragAnchorRowcol = toRowcol;
      return;
    }
    var dr = toRowcol.r - resizeDragAnchorRowcol.r;
    var dc = toRowcol.c - resizeDragAnchorRowcol.c;
    if (dr === 0 && dc === 0) return;
    if (dr > 0) setTop(Math.max(level.height - dr, 2), changeLog);
    if (dc > 0) setLeft(Math.max(level.width - dc, 2), changeLog);
    if (dr < 0) setHeight(Math.max(level.height + dr, 2), changeLog);
    if (dc < 0) setWidth(Math.max(level.width + dc, 2), changeLog);
    resizeDragAnchorRowcol = null;
  } else if (paintBrushTileCode === "select") {
    selectionEnd = location;
  } else if (paintBrushTileCode === "paste") {
    var hoverRowcol = getRowcol(level, location);
    var pastedData = previewPaste(hoverRowcol.r, hoverRowcol.c);
    pastedData.selectedLocations.forEach(function(location) {
      var tileCode = pastedData.level.map[location];
      removeAnyObjectAtLocation(location, changeLog);
      paintTileAtLocation(location, tileCode, changeLog);
    });
    pastedData.selectedObjects.forEach(function(object) {
      // refresh the ids so there are no collisions.
      if (object.type === SNAKE) {
        object.id = newSnake(object.id % snakeColors.length).id;
      } else if (object.type === BLOCK) {
        object.id = newBlock().id;
      } else if (object.type === FRUIT) {
        object.id = newFruit().id;
      } else if (object.type === POISONFRUIT) {
        object.id = newPoisonFruit().id;
      } else throw unreachable();
      level.objects.push(object);
      changeLog.push([object.type, object.id, [0,[]], serializeObjectState(object)]);
    });
  } else if (paintBrushTileCode === SNAKE) {
    var oldSnakeSerialization = serializeObjectState(paintBrushObject);
    if (paintBrushObject != null) {
      // keep dragging
      if (paintBrushObject.locations[0] === location) return; // we just did that
      // watch out for self-intersection
      var selfIntersectionIndex = paintBrushObject.locations.indexOf(location);
      if (selfIntersectionIndex !== -1) {
        // truncate from here back
        paintBrushObject.locations.splice(selfIntersectionIndex);
      }
    }

    // make sure there's space behind us
    // exclude opengate for clarity
    if (!isTileCodeCoverable(level.map[location]) || level.map[location] === OPENGATE) {
      paintTileAtLocation(location, SPACE, changeLog);
    }
    removeAnyObjectAtLocation(location, changeLog);
    if (paintBrushObject == null) {
      var thereWereNoSnakes = countSnakes() === 0;
      paintBrushObject = newSnake(paintBrushSnakeColorIndex, location);
      level.objects.push(paintBrushObject);
      if (thereWereNoSnakes) activateAnySnakePlease();
    } else {
      // extend le snake
      paintBrushObject.locations.unshift(location);
    }
    changeLog.push([paintBrushObject.type, paintBrushObject.id, oldSnakeSerialization, serializeObjectState(paintBrushObject)]);
  } else if (paintBrushTileCode === BLOCK) {
    var objectHere = findObjectAtLocation(location);
    if (paintBrushBlockId == null && objectHere != null && objectHere.type === BLOCK) {
      // just start editing this block
      paintBrushBlockId = objectHere.id;
    } else {
      // make a change
      // make sure there's space behind us
      // exclude opengate for clarity
      if (!isTileCodeCoverable(level.map[location]) || level.map[location] === OPENGATE) {
        paintTileAtLocation(location, SPACE, changeLog);
      }
      var thisBlock = null;
      if (paintBrushBlockId != null) {
        thisBlock = findBlockById(paintBrushBlockId);
      }
      var oldBlockSerialization = serializeObjectState(thisBlock);
      if (thisBlock == null) {
        // create new block
        removeAnyObjectAtLocation(location, changeLog);
        thisBlock = newBlock(location);
        level.objects.push(thisBlock);
        paintBrushBlockId = thisBlock.id;
      } else {
        var existingIndex = thisBlock.locations.indexOf(location);
        if (existingIndex !== -1) {
          // reclicking part of this object means to delete just part of it.
          if (thisBlock.locations.length === 1) {
            // goodbye
            removeObject(thisBlock, changeLog);
            paintBrushBlockId = null;
          } else {
            thisBlock.locations.splice(existingIndex, 1);
          }
        } else {
          // add a tile to the block
          removeAnyObjectAtLocation(location, changeLog);
          thisBlock.locations.push(location);
        }
      }
      changeLog.push([thisBlock.type, thisBlock.id, oldBlockSerialization, serializeObjectState(thisBlock)]);
      delete blockSupportRenderCache[thisBlock.id];
    }
  } else if (paintBrushTileCode === FRUIT) {
    // fruit covers other coverable tiles too much, only cover platforms
    if (!isTileCodePlatform(level.map[location])) {
      paintTileAtLocation(location, SPACE, changeLog);
    }
    removeAnyObjectAtLocation(location, changeLog);
    var object = newFruit(location)
    level.objects.push(object);
    changeLog.push([object.type, object.id, serializeObjectState(null), serializeObjectState(object)]);
  } else if (paintBrushTileCode === POISONFRUIT) {
    // fruit covers other coverable tiles too much, only cover platforms
    if (!isTileCodePlatform(level.map[location])) {
      paintTileAtLocation(location, SPACE, changeLog);
    }
    removeAnyObjectAtLocation(location, changeLog);
    var object = newPoisonFruit(location)
    level.objects.push(object);
    changeLog.push([object.type, object.id, serializeObjectState(null), serializeObjectState(object)]);
  } else throw unreachable();
  render();
}

function paintTileAtLocation(location, tileCode, changeLog) {
  if (level.map[location] === tileCode) return;
  changeLog.push(["m", location, level.map[location], tileCode]);
  level.map[location] = tileCode;
}

function pushUndo(undoStuff, changeLog) {
  // changeLog = [
  //   ["i", 0, -1, 0, animationQueue, freshlyRemovedAnimatedObjects],
  //                                                 // player input for snake 0, dr:-1, dc:0. has no effect on state.
  //                                                 //   "i" is always the first change in normal player movement.
  //                                                 //   if a changeLog does not start with "i", then it is an editor action.
  //                                                 //   animationQueue and freshlyRemovedAnimatedObjects
  //                                                 //   are used for animating re-move.
  //   ["m", 21, 0, 1],                              // map at location 23 changed from 0 to 1
  //   ["s", 0, [false, [1,2]], [false, [2,3]]],     // snake id 0 moved from alive at [1, 2] to alive at [2, 3]
  //   ["s", 1, [false, [11,12]], [true, [12,13]]],  // snake id 1 moved from alive at [11, 12] to dead at [12, 13]
  //   ["b", 1, [false, [20,30]], [false, []]],      // block id 1 was deleted from location [20, 30]
  //   ["f", 0, [false, [40]], [false, []]],         // fruit id 0 was deleted from location [40]
  //   ["p", 0, [false, [40]], [false, []]],         // poisonfruit id 0 was deleted from location [40]
  //   ["t", 25, 10],                                // height changed from 25 to 10 from the top, shifting all tiles and objects.
  //   ["l", 8, 10],                                 // width changed from 8 to 10 from the left, shifting all tiles and objects.
  //   ["h", 25, 10],                                // height changed from 25 to 10. all cropped tiles are guaranteed to be SPACE.
  //   ["w", 8, 10],                                 // width changed from 8 to 10. a change in the coordinate system.
  //   ["m", 23, 2, 0],                              // map at location 23 changed from 2 to 0 in the new coordinate system.
  //   10,                                           // the last change is always a declaration of the final width of the map.
  // ];
  reduceChangeLog(changeLog);
  if (changeLog.length === 0) return;
  changeLog.push(level.width);
  undoStuff.undoStack.push(changeLog);
  undoStuff.redoStack = [];
  paradoxes = [];

  if (undoStuff === uneditStuff) editorHasBeenTouched = true;

  undoStuffChanged(undoStuff);
}
function reduceChangeLog(changeLog) {
  for (var i = 0; i < changeLog.length - 1; i++) {
    var change = changeLog[i];
    if (change[0] === "i") {
      continue; // don't reduce player input
    } else if (change[0] === "t") {
      for (var j = i + 1; j < changeLog.length; j++) {
        var otherChange = changeLog[j];
        if (otherChange[0] === "t") {
          // combine
          change[2] = otherChange[2];
          changeLog.splice(j, 1);
          j--;
          continue;
        } else if (otherChange[0] === "w" || otherChange[0] === "l") {
          continue; // no interaction between top and height
        } else break; // no more reduction possible
      }
      if (change[1] === change[2]) {
        // no change
        changeLog.splice(i, 1);
        i--;
      }
    } else if (change[0] === "l") {
      for (var j = i + 1; j < changeLog.length; j++) {
        var otherChange = changeLog[j];
        if (otherChange[0] === "l") {
          // combine
          change[2] = otherChange[2];
          changeLog.splice(j, 1);
          j--;
          continue;
        } else if (otherChange[0] === "h" || otherChange[0] === "t") {
          continue; // no interaction between left and width
        } else break; // no more reduction possible
      }
      if (change[1] === change[2]) {
        // no change
        changeLog.splice(i, 1);
        i--;
      }
    } else if (change[0] === "h") {
      for (var j = i + 1; j < changeLog.length; j++) {
        var otherChange = changeLog[j];
        if (otherChange[0] === "h") {
          // combine
          change[2] = otherChange[2];
          changeLog.splice(j, 1);
          j--;
          continue;
        } else if (otherChange[0] === "w" || otherChange[0] === "l") {
          continue; // no interaction between height and top
        } else break; // no more reduction possible
      }
      if (change[1] === change[2]) {
        // no change
        changeLog.splice(i, 1);
        i--;
      }
    } else if (change[0] === "w") {
      for (var j = i + 1; j < changeLog.length; j++) {
        var otherChange = changeLog[j];
        if (otherChange[0] === "w") {
          // combine
          change[2] = otherChange[2];
          changeLog.splice(j, 1);
          j--;
          continue;
        } else if (otherChange[0] === "h" || otherChange[0] === "t") {
          continue; // no interaction between width and left
        } else break; // no more reduction possible
      }
      if (change[1] === change[2]) {
        // no change
        changeLog.splice(i, 1);
        i--;
      }
    } else if (change[0] === "m") {
      for (var j = i + 1; j < changeLog.length; j++) {
        var otherChange = changeLog[j];
        if (otherChange[0] === "m" && otherChange[1] === change[1]) {
          // combine
          change[3] = otherChange[3];
          changeLog.splice(j, 1);
          j--;
        } else if (otherChange[0] === "w" || otherChange[0] === "h" || otherChange[0] === "l" || otherChange[0] === "t") {
          break; // can't reduce across resizes
        }
      }
      if (change[2] === change[3]) {
        // no change
        changeLog.splice(i, 1);
        i--;
      }
    } else if (change[0] === SNAKE || change[0] === BLOCK || change[0] === FRUIT || change[0] === POISONFRUIT) {
      for (var j = i + 1; j < changeLog.length; j++) {
        var otherChange = changeLog[j];
        if (otherChange[0] === change[0] && otherChange[1] === change[1]) {
          // combine
          change[3] = otherChange[3];
          changeLog.splice(j, 1);
          j--;
        } else if (otherChange[0] === "w" || otherChange[0] === "h" || otherChange[0] === "l" || otherChange[0] === "t") {
          break; // can't reduce across resizes
        }
      }
      if (deepEquals(change[2], change[3])) {
        // no change
        changeLog.splice(i, 1);
        i--;
      }
    } else throw unreachable();
  }
}
function undo(undoStuff) {
  if (undoStuff.undoStack.length === 0) return; // already at the beginning
  animationQueue = [];
  animationQueueCursor = 0;
  paradoxes = [];
  portalCollisionMap = {};
  portalsBlocked = false;
  undoOneFrame(undoStuff);
  undoStuffChanged(undoStuff);
}
function reset(undoStuff) {
  animationQueue = [];
  animationQueueCursor = 0;
  paradoxes = [];
  portalCollisionMap = {};
  portalsBlocked = false;
  while (undoStuff.undoStack.length > 0) {
    undoOneFrame(undoStuff);
  }
  undoStuffChanged(undoStuff);
}
function undoOneFrame(undoStuff) {
  var doThis = undoStuff.undoStack.pop();
  var redoChangeLog = [];
  undoChanges(doThis, redoChangeLog);
  if (redoChangeLog.length > 0) {
    redoChangeLog.push(level.width);
    undoStuff.redoStack.push(redoChangeLog);
  }

  if (undoStuff === uneditStuff) editorHasBeenTouched = true;
}
function redo(undoStuff) {
  if (undoStuff.redoStack.length === 0) return; // already at the beginning
  animationQueue = [];
  animationQueueCursor = 0;
  paradoxes = [];
  redoOneFrame(undoStuff);
  undoStuffChanged(undoStuff);
}
function unreset(undoStuff) {
  animationQueue = [];
  animationQueueCursor = 0;
  paradoxes = [];
  while (undoStuff.redoStack.length > 0) {
    redoOneFrame(undoStuff);
  }
  undoStuffChanged(undoStuff);

  // don't animate the last frame unless dying
  if (!isDead()) {
    animationQueue = [];
    animationQueueCursor = 0;
    freshlyRemovedAnimatedObjects = [];
  }
}
function redoOneFrame(undoStuff) {
  var doThis = undoStuff.redoStack.pop();
  var undoChangeLog = [];
  undoChanges(doThis, undoChangeLog);
  if (undoChangeLog.length > 0) {
    undoChangeLog.push(level.width);
    undoStuff.undoStack.push(undoChangeLog);
  }

  if (undoStuff === uneditStuff) editorHasBeenTouched = true;
}
function undoChanges(changes, changeLog) {
  var widthContext = changes.pop();
  var transformLocation = widthContext === level.width ? identityFunction : makeScaleCoordinatesFunction(widthContext, level.width, 0);
  for (var i = changes.length - 1; i >= 0; i--) {
    var paradoxDescription = undoChange(changes[i]);
    if (paradoxDescription != null) paradoxes.push(paradoxDescription);
  }

  var lastChange = changes[changes.length - 1];
  if (lastChange[0] === "i") {
    // replay animation
    animationQueue = lastChange[4];
    animationQueueCursor = 0;
    freshlyRemovedAnimatedObjects = lastChange[5];
    animationStart = performance.now();
  }

  function undoChange(change) {
    // note: everything here is going backwards: to -> from
    if (change[0] === "i") {
      // no state change, but preserve the intention.
      changeLog.push(change);
      return null;
    } else if (change[0] === "t") {
      // change height from top
      var fromHeight = change[1];
      var   toHeight = change[2];
      if (level.height !== toHeight) return "Impossible";
      setTop(fromHeight, changeLog);
    } else if (change[0] === "l") {
      // change width from left
      var fromWidth = change[1];
      var   toWidth = change[2];
      if (level.width !== toWidth) return "Impossible";
      setLeft(fromWidth, changeLog);
    } else if (change[0] === "h") {
      // change height
      var fromHeight = change[1];
      var   toHeight = change[2];
      if (level.height !== toHeight) return "Impossible";
      setHeight(fromHeight, changeLog);
    } else if (change[0] === "w") {
      // change width
      var fromWidth = change[1];
      var   toWidth = change[2];
      if (level.width !== toWidth) return "Impossible";
      setWidth(fromWidth, changeLog);
    } else if (change[0] === "m") {
      // change map tile
      var location = transformLocation(change[1]);
      var fromTileCode = change[2];
      var   toTileCode = change[3];
      if (location >= level.map.length) return "Can't turn " + describe(toTileCode) + " into " + describe(fromTileCode) + " out of bounds";
      if (level.map[location] !== toTileCode) return "Can't turn " + describe(toTileCode) + " into " + describe(fromTileCode) + " because there's " + describe(level.map[location]) + " there now";
      paintTileAtLocation(location, fromTileCode, changeLog);
    } else if (change[0] === SNAKE || change[0] === BLOCK || change[0] === FRUIT || change[0] === POISONFRUIT) {
      // change object
      var type = change[0];
      var id = change[1];
      var fromDead = change[2][0];
      var   toDead = change[3][0];
      var fromLocations = change[2][1].map(transformLocation);
      var   toLocations = change[3][1].map(transformLocation);
      if (fromLocations.filter(function(location) { return location >= level.map.length; }).length > 0) {
        return "Can't move " + describe(type, id) + " out of bounds";
      }
      var object = findObjectOfTypeAndId(type, id);
      if (toLocations.length !== 0) {
        // should exist at this location
        if (object == null) return "Can't move " + describe(type, id) + " because it doesn't exit";
        if (!deepEquals(object.locations, toLocations)) return "Can't move " + describe(object) + " because it's in the wrong place";
        if (object.dead !== toDead) return "Can't move " + describe(object) + " because it's alive/dead state doesn't match";
        // doit
        if (fromLocations.length !== 0) {
          var oldState = serializeObjectState(object);
          object.locations = fromLocations;
          object.dead = fromDead;
          changeLog.push([object.type, object.id, oldState, serializeObjectState(object)]);
        } else {
          removeObject(object, changeLog);
        }
      } else {
        // shouldn't exist
        if (object != null) return "Can't create " + describe(type, id) + " because it already exists";
        // doit
        object = {
          type: type,
          id: id,
          dead: fromDead,
          locations: fromLocations,
        };
        level.objects.push(object);
        changeLog.push([object.type, object.id, [0,[]], serializeObjectState(object)]);
      }
    } else throw unreachable();
  }
}
function describe(arg1, arg2) {
  // describe(0) -> "Space"
  // describe(SNAKE, 0) -> "Snake 0 (Red)"
  // describe(object) -> "Snake 0 (Red)"
  // describe(BLOCK, 1) -> "Block 1"
  // describe(FRUIT) -> "Fruit"
  if (typeof arg1 === "number") {
    switch (arg1) {
      case SPACE: return "Space";
      case WALL:  return "a Wall";
      case SPIKE: return "Spikes";
      case EXIT:  return "an Exit";
      case PORTAL:  return "a Portal";
      default: throw unreachable();
    }
  }
  if (arg1 === SNAKE) {
    return "Snake " + arg2 + " (" + snakeColorNames[arg2 % snakeColorNames.length] + ")";
  }
  if (arg1 === BLOCK) {
    return "Block " + arg2;
  }
  if (arg1 === FRUIT) {
    return "Fruit";
  }
  if (arg1 === POISONFRUIT) {
    return "Poison Fruit";
  }
  if (typeof arg1 === "object") return describe(arg1.type, arg1.id);
  throw unreachable();
}

function undoStuffChanged(undoStuff) {
  var movesText = undoStuff.undoStack.length + "+" + undoStuff.redoStack.length;
  document.getElementById(undoStuff.spanId).textContent = movesText;
  document.getElementById(undoStuff.undoButtonId).disabled = undoStuff.undoStack.length === 0;
  document.getElementById(undoStuff.redoButtonId).disabled = undoStuff.redoStack.length === 0;
  if (undoStuff.undoStack.length === 0 && undoStuff.redoStack.length > 0) {
    document.getElementById("restartButton").textContent = "Fast Forward";
    document.getElementById("touchRestartButton").textContent = "skip_next";
  } else {
    document.getElementById("restartButton").textContent = "Restart";
    document.getElementById("touchRestartButton").textContent = "skip_previous";
  }

  // render paradox display
  var uniqueParadoxes = [];
  var paradoxCounts = [];
  paradoxes.forEach(function(paradoxDescription) {
    var index = uniqueParadoxes.indexOf(paradoxDescription);
    if (index !== -1) {
      paradoxCounts[index] += 1;
    } else {
      uniqueParadoxes.push(paradoxDescription);
      paradoxCounts.push(1);
    }
  });
  var paradoxDivContent = "";
  uniqueParadoxes.forEach(function(paradox, i) {
    if (i > 0) paradoxDivContent += "<br>\n";
    if (paradoxCounts[i] > 1) paradoxDivContent += "(" + paradoxCounts[i] + "x) ";
    paradoxDivContent += "Time Travel Paradox! " + uniqueParadoxes[i];
  });
  document.getElementById("paradoxDiv").innerHTML = paradoxDivContent;

  updateDirtyState();

  if (undoStuff.undoStack.length > 0 || unmoveStuff.redoStack.length === 0) {
    document.getElementById("removeButton").style.fontWeight = "normal";
  }
}

var CLEAN_NO_TIMELINES = 0;
var CLEAN_WITH_REDO = 1;
var REPLAY_DIRTY = 2;
var EDITOR_DIRTY = 3;
var dirtyState = CLEAN_NO_TIMELINES;
var editorHasBeenTouched = false;
function updateDirtyState() {
  if (haveCheatcodesBeenUsed() || editorHasBeenTouched) {
    dirtyState = EDITOR_DIRTY;
  } else if (unmoveStuff.undoStack.length > 0) {
    dirtyState = REPLAY_DIRTY;
  } else if (unmoveStuff.redoStack.length > 0) {
    dirtyState = CLEAN_WITH_REDO;
  } else {
    dirtyState = CLEAN_NO_TIMELINES;
  }

  var saveLevelButton = document.getElementById("saveLevelButton");
  // the save button clears your timelines
  saveLevelButton.disabled = dirtyState === CLEAN_NO_TIMELINES;
  if (dirtyState >= EDITOR_DIRTY) {
    // you should save
    saveLevelButton.style.fontWeight = "bold";
    saveLevelButton.textContent = "*" + "Save Level";
  } else {
    saveLevelButton.style.fontWeight = "normal";
    saveLevelButton.textContent = "Save Level";
  }

  var saveProgressButton = document.getElementById("saveProgressButton");
  // you can't save a replay if your level is dirty
  if (dirtyState === CLEAN_WITH_REDO) {
    saveProgressButton.textContent = "Forget Progress";
  } else {
    saveProgressButton.textContent = "Save Progress";
  }
  saveProgressButton.disabled = dirtyState >= EDITOR_DIRTY || dirtyState === CLEAN_NO_TIMELINES;
}
function haveCheatcodesBeenUsed() {
  return !unmoveStuff.undoStack.every(function(changeLog) {
    // normal movement always starts with "i".
    return changeLog[0][0] === "i";
  });
}

var persistentState = {
  showEditor: false,
  showGrid: true,
};
function savePersistentState() {
  localStorage.snakefall = JSON.stringify(persistentState);
}
function loadPersistentState() {
  try {
    persistentState = JSON.parse(localStorage.snakefall);
  } catch (e) {
  }
  persistentState.showEditor = !!persistentState.showEditor;
  persistentState.showGrid = !!persistentState.showGrid;
  showEditorChanged();
}
var isGravityEnabled = true;
function isGravity() {
  return isGravityEnabled || !persistentState.showEditor;
}
var isCollisionEnabled = true;
function isCollision() {
  return isCollisionEnabled || !persistentState.showEditor;
}
function isAnyCheatcodeEnabled() {
  return persistentState.showEditor && (
    !isGravityEnabled || !isCollisionEnabled
  );
}


function showEditorChanged() {
  document.getElementById("showHideEditor").textContent = (persistentState.showEditor ? "Hide" : "Show") + " Editor";
  ["editorDiv", "editorPane"].forEach(function(id) {
    document.getElementById(id).style.display = persistentState.showEditor ? "block" : "none";
  });
  document.getElementById("wasdSpan").textContent = persistentState.showEditor ? "" : "/WASD";

  render();
}

function move(dr, dc) {
  portalCollisionMap = {};
  portalsBlocked = false;
  if (!isAlive()) return;
  animationQueue = [];
  animationQueueCursor = 0;
  freshlyRemovedAnimatedObjects = [];
  animationStart = performance.now();
  var activeSnake = findActiveSnake();
  var headRowcol = getRowcol(level, activeSnake.locations[0]);
  var newRowcol = {r:headRowcol.r + dr, c:headRowcol.c + dc};
  if (!isInBounds(level, newRowcol.r, newRowcol.c)) return;
  var newLocation = getLocation(level, newRowcol.r, newRowcol.c);
  var changeLog = [];

  // The changeLog for a player movement starts with the input
  // when playing normally.
  if (!isAnyCheatcodeEnabled()) {
    changeLog.push(["i", activeSnake.id, dr, dc, animationQueue, freshlyRemovedAnimatedObjects]);
  }

  var ate = 0;
  var pushedObjects = [];

  //track OpenGates that had objects on them
  var occupiedOpenGates = getOccupiedOpenGateLocations();

  if (isCollision()) {
    var newTile = level.map[newLocation];
    if (newTile === DIGGABLEDIRT || newTile === FOAM) {
      // dig
      paintTileAtLocation(newLocation, SPACE, changeLog);
      newTile = level.map[newLocation];
    }
    if (!isTileCodeAir(activeSnake, null, newTile, dr, dc)) return; // can't go through that tile
    var otherObject = findObjectAtLocation(newLocation);
    if (otherObject != null) {
      if (otherObject === activeSnake) return; // can't push yourself
      if (otherObject.type === FRUIT) {
        // eat
        removeObject(otherObject, changeLog);
        ate = 1;
      } else if (otherObject.type === POISONFRUIT) {
        // eat if long enough
        if (activeSnake.locations.length <= 1) return;
        removeObject(otherObject, changeLog);
        ate = -1;
      } else {
        // push objects
        if (!checkMovement(activeSnake, otherObject, dr, dc, pushedObjects)) return false;
      }
    }
  }

  // slither forward
  var activeSnakeOldState = serializeObjectState(activeSnake);
  var size1 = activeSnake.locations.length + ate === 1;
  var slitherAnimations = [
    70,
    [
      // size-1 snakes really do more of a move than a slither
      size1 ? MOVE_SNAKE : SLITHER_HEAD,
      activeSnake.id,
      dr,
      dc,
    ]
  ];
  activeSnake.locations.unshift(newLocation);
  while (ate < 1) {
    // drag your tail forward
    var oldRowcol = getRowcol(level, activeSnake.locations[activeSnake.locations.length - 1]);
    var newRowcol = getRowcol(level, activeSnake.locations[activeSnake.locations.length - 2]);
    if (!size1 && ate === 0) {
      slitherAnimations.push([
        SLITHER_TAIL,
        activeSnake.id,
        newRowcol.r - oldRowcol.r,
        newRowcol.c - oldRowcol.c,
      ]);
    }
    activeSnake.locations.pop();
    ate += 1;
  }
  changeLog.push([activeSnake.type, activeSnake.id, activeSnakeOldState, serializeObjectState(activeSnake)]);

  // did you just push your face into a portal?
  var portalLocations = getActivePortalLocations();
  var portalActivationLocations = [];
  if (portalLocations.indexOf(newLocation) !== -1) {
    portalActivationLocations.push(newLocation);
  }
  // push everything, too
  moveObjects(pushedObjects, dr, dc, portalLocations, portalActivationLocations, changeLog, slitherAnimations);
  animationQueue.push(slitherAnimations);

  occupiedOpenGates = combineOldAndNewGateOccupations(occupiedOpenGates);

  // gravity loop
  var stateToAnimationIndex = {};
  if (isGravity()) for (var fallHeight = 1;; fallHeight++) {
    var serializedState = serializeObjects(level.objects);
    var infiniteLoopStartIndex = stateToAnimationIndex[serializedState];
    if (infiniteLoopStartIndex > 1) {
      // infinite loop
      animationQueue.push([0, [INFINITE_LOOP, animationQueue.length - infiniteLoopStartIndex]]);
      break;
    } else {
      stateToAnimationIndex[serializedState] = animationQueue.length;
    }
    // do portals separate from falling logic
    if (portalActivationLocations.length === 1) {
      var portalAnimations = [500];
      if (activatePortal(portalLocations, portalActivationLocations[0], portalAnimations, changeLog)) {
        animationQueue.push(portalAnimations);
      }
      portalActivationLocations = [];
    }
    if (portalActivationLocations.length === 2) {
      portalsBlocked = true;
      portalActivationLocations = [];
    }
    // now do falling logic
    var didAnything = false;
    var fallingAnimations = [
      70 / Math.sqrt(fallHeight),
    ];
    var exitAnimationQueue = [];

    // check for exit
    if (!isUneatenFruit()) {
      var snakes = getSnakes();
      for (var i = 0; i < snakes.length; i++) {
        var snake = snakes[i];
        if (level.map[snake.locations[0]] === EXIT) {
          // (one of) you made it!
          removeAnimatedObject(snake, changeLog);
          exitAnimationQueue.push([
            200,
            [EXIT_SNAKE, snake.id, 0, 0],
          ]);
          didAnything = true;
        }
      }
    }

    occupiedOpenGates = combineOldAndNewGateOccupations(occupiedOpenGates);
    occupiedOpenGates = closeGates(occupiedOpenGates, changeLog); // gates now close before first fall step

    // fall
    var dyingObjects = [];
    var fallingObjects = level.objects.filter(function(object) {
      if (object.type === FRUIT || object.type === POISONFRUIT) return; // can't fall
      var theseDyingObjects = [];
      if (!checkMovement(null, object, 1, 0, [], theseDyingObjects)) return false;
      // this object can fall. maybe more will fall with it too. we'll check those separately.
      theseDyingObjects.forEach(function(object) {
        addIfNotPresent(dyingObjects, object);
      });
      return true;
    });
    if (dyingObjects.length > 0) {
      var anySnakesDied = false;
      dyingObjects.forEach(function(object) {
        if (object.type === SNAKE) {
          // look what you've done
          var oldState = serializeObjectState(object);
          object.dead = true;
          changeLog.push([object.type, object.id, oldState, serializeObjectState(object)]);
          anySnakesDied = true;
        } else if (object.type === BLOCK) {
          // a box fell off the world
          removeAnimatedObject(object, changeLog);
          removeFromArray(fallingObjects, object);
          exitAnimationQueue.push([
            200,
            [
              DIE_BLOCK,
              object.id,
              0, 0
            ],
          ]);
          didAnything = true;
        } else throw unreachable();
      });
      if (anySnakesDied) break;
    }
    if (fallingObjects.length > 0) {
      moveObjects(fallingObjects, 1, 0, portalLocations, portalActivationLocations, changeLog, fallingAnimations);
      didAnything = true;
    }

    if (!didAnything) break;
    Array.prototype.push.apply(animationQueue, exitAnimationQueue);
    if (fallingAnimations.length > 1) animationQueue.push(fallingAnimations);
  }

  pushUndo(unmoveStuff, changeLog);
}

function combineOldAndNewGateOccupations(oldOccupiedOpenGates)
{
  var newOccupiedOpenGates = getOccupiedOpenGateLocations();
  var newlyOccupiedOpenGates = getSetSubtract(newOccupiedOpenGates, oldOccupiedOpenGates);
  return oldOccupiedOpenGates.concat(newlyOccupiedOpenGates);
}

function closeGates(oldOccupiedOpenGates, changeLog)
{
  var newOccupiedOpenGates = getOccupiedOpenGateLocations();
  var nowUnoccupiedOpenGates = getSetSubtract(oldOccupiedOpenGates, newOccupiedOpenGates);
  for (var i = 0; i < nowUnoccupiedOpenGates.length; i++) {
    paintTileAtLocation(nowUnoccupiedOpenGates[i], CLOSEDGATE, changeLog);
  }
  return newOccupiedOpenGates;
}

function checkMovement(pusher, pushedObject, dr, dc, pushedObjects, dyingObjects) {
  // pusher can be null (for gravity)
  pushedObjects.push(pushedObject);
  // find forward locations
  var forwardLocations = [];
  for (var i = 0; i < pushedObjects.length; i++) {
    pushedObject = pushedObjects[i];
    for (var j = 0; j < pushedObject.locations.length; j++) {
      var rowcol = getRowcol(level, pushedObject.locations[j]);
      var forwardRowcol = {r:rowcol.r + dr, c:rowcol.c + dc};
      if (!isInBounds(level, forwardRowcol.r, forwardRowcol.c)) {
        if (dyingObjects == null) {
          // can't push things out of bounds
          return false;
        } else {
          // this thing is going to fall out of bounds
          addIfNotPresent(dyingObjects, pushedObject);
          addIfNotPresent(pushedObjects, pushedObject);
          continue;
        }
      }
      var forwardLocation = getLocation(level, forwardRowcol.r, forwardRowcol.c);
      if (isTileCodePlatform(level.map[forwardLocation]) && !isTileCodeAir(pusher, pushedObject, level.map[forwardLocation], dr, dc)) {
        // this platform holds us, unless we're going through it
        var neighborLocations;
        if (pushedObject.type === SNAKE) {
          neighborLocations = [];
          if (j > 0) neighborLocations.push(pushedObject.locations[j - 1]);
          if (j < pushedObject.locations.length - 1) neighborLocations.push(pushedObject.locations[j + 1]);
        } else if (pushedObject.type === BLOCK) {
          neighborLocations = pushedObject.locations;
        } else throw unreachable();
        if (neighborLocations.indexOf(forwardLocation) === -1) return false; // flat surface
        // we slip right past it
      }
      var yetAnotherObject = findObjectAtLocation(forwardLocation);
      if (yetAnotherObject != null) {
        if (yetAnotherObject.type === FRUIT || yetAnotherObject.type === POISONFRUIT) {
          // not pushable
          return false;
        }
        if (yetAnotherObject === pusher) {
          // indirect pushing ourselves.
          // special check for when we're indirectly pushing the tip of our own tail.
          if (forwardLocation === pusher.locations[pusher.locations.length -1]) {
            // for some reason this is ok.
            continue;
          }
          return false;
        }
        addIfNotPresent(pushedObjects, yetAnotherObject);
      } else {
        addIfNotPresent(forwardLocations, forwardLocation);
      }
    }
  }
  // check forward locations
  for (var i = 0; i < forwardLocations.length; i++) {
    var forwardLocation = forwardLocations[i];
    // many of these locations can be inside objects,
    // but that means the tile must be air,
    // and we already know pushing that object.
    var tileCode = level.map[forwardLocation];
    var object = findObjectAtLocation(offsetLocation(forwardLocation, -dr, -dc));
    if (!isTileCodeAir(pusher, object, tileCode, dr, dc)) {
      if (tileCode === SPIKE && dyingObjects != null) {
          // uh... which object was this again?
          var deadObject = findObjectAtLocation(offsetLocation(forwardLocation, -dr, -dc));
          if (deadObject.type === SNAKE) {
            // ouch!
            addIfNotPresent(dyingObjects, deadObject);
            continue;
        }
      }
      // can't push into something solid
      return false;
    }
  }
  // the push is go
  return true;
}

function activateAnySnakePlease() {
  var snakes = getSnakes();
  if (snakes.length === 0) return; // nope.avi
  activeSnakeId = snakes[0].id;
}

function moveObjects(objects, dr, dc, portalLocations, portalActivationLocations, changeLog, animations) {
  objects.forEach(function(object) {
    var oldState = serializeObjectState(object);
    var oldPortals = getSetIntersection(portalLocations, object.locations);
    for (var i = 0; i < object.locations.length; i++) {
      object.locations[i] = offsetLocation(object.locations[i], dr, dc);
      if (level.map[object.locations[i]] === FOAM)
      {
        paintTileAtLocation(object.locations[i], SPACE, changeLog);
      }
    }
    changeLog.push([object.type, object.id, oldState, serializeObjectState(object)]);
    animations.push([
      "m" + object.type, // MOVE_SNAKE | MOVE_BLOCK
      object.id,
      dr,
      dc,
    ]);

    var newPortals = getSetIntersection(portalLocations, object.locations);
    var activatingPortals = newPortals.filter(function(portalLocation) {
      return oldPortals.indexOf(portalLocation) === -1;
    });
    if (activatingPortals.length === 1) {
      // exactly one new portal we're touching. activate it
      portalActivationLocations.push(activatingPortals[0]);
    }
    if (activatingPortals.length === 2) {
      portalsBlocked = true;
    }
  });
}

function activatePortal(portalLocations, portalLocation, animations, changeLog) {
  var otherPortalLocation = portalLocations[1 - portalLocations.indexOf(portalLocation)];
  var portalRowcol = getRowcol(level, portalLocation);
  var otherPortalRowcol = getRowcol(level, otherPortalLocation);
  var delta = {r:otherPortalRowcol.r - portalRowcol.r, c:otherPortalRowcol.c - portalRowcol.c};

  var didCollide = false;

  var object = findObjectAtLocation(portalLocation);
  var newLocations = [];

  // only added to the global map if there is at least one collision (or OOB),
  // so that diagram isn't drawn on successful teleport
  var collisionDiagram = {};

  for (var i = 0; i < object.locations.length; i++) {
    var rowcol = getRowcol(level, object.locations[i]);
    var r = rowcol.r + delta.r;
    var c = rowcol.c + delta.c;

    // out of bounds
    if (!isInBounds(level, r, c)) {
      didCollide = true;
      continue;
    }

    var loc = getLocation(level, r, c)
    newLocations.push(loc);
    collisionDiagram[loc] = false

    // blocked by tile
    if (!isTileCodeAir(object, null, level.map[loc], 0, 0)) {
      didCollide = true;
      collisionDiagram[loc] = true;
    }

    // blocked by object
    var otherObject = findObjectAtLocation(loc);
    if (otherObject != null && otherObject !== object) {
      didCollide = true;
      collisionDiagram[loc] = true;
    }
  }

  // teleport blocked
  if (didCollide) {
    // this diagram will be drawn
    portalCollisionMap = { ...portalCollisionMap, ...collisionDiagram };
    return false;
  }

  // zappo presto!
  var oldState = serializeObjectState(object);
  object.locations = newLocations;
  for (var i = 0; i < newLocations.length; i++) {
    if (level.map[newLocations[i]] === FOAM)
    {
      paintTileAtLocation(object.locations[i], SPACE, changeLog);
    }
  }
  changeLog.push([object.type, object.id, oldState, serializeObjectState(object)]);
  animations.push([
    "t" + object.type, // TELEPORT_SNAKE | TELEPORT_BLOCK
    object.id,
    delta.r,
    delta.c,
  ]);

  return true;
}

function isTileCodeAir(pusher, pushedObject, tileCode, dr, dc) {
  switch (tileCode)
  {
    case SPACE: case EXIT: case PORTAL: case OPENGATE: return true;
    case FOAM: return pusher != null;
    case PLATFORM: return dr != 1;
    case PLATFORMU: return dr != 1;
    case PLATFORMD: return dr != -1;
    case PLATFORML: return dc != 1;
    case PLATFORMR: return dc != -1;
    case WOODPLATFORM: return dr != 1 || pusher != null;
    default: return false;
  }
}

function isTileCodePlatform(tileCode) {
  switch (tileCode)
  {
    case PLATFORM: case PLATFORMU: case PLATFORMD: case PLATFORML: case PLATFORMR: case WOODPLATFORM: return true;
    default: return false;
  }
}
function isTileCodeCoverable(tileCode) {
  switch (tileCode)
  {
    case SPACE: case EXIT: case PORTAL: case PLATFORM: case PLATFORMU: case PLATFORMD: case PLATFORML: case PLATFORMR: case WOODPLATFORM: case OPENGATE: return true;
    default: return false;
  }
}

function addIfNotPresent(array, element) {
  if (array.indexOf(element) !== -1) return;
  array.push(element);
}
function removeAnyObjectAtLocation(location, changeLog) {
  var object = findObjectAtLocation(location);
  if (object != null) removeObject(object, changeLog);
}
function removeAnimatedObject(object, changeLog) {
  removeObject(object, changeLog);
  freshlyRemovedAnimatedObjects.push(object);
}
function removeObject(object, changeLog) {
  removeFromArray(level.objects, object);
  changeLog.push([object.type, object.id, [object.dead, copyArray(object.locations)], [0,[]]]);
  if (object.type === SNAKE && object.id === activeSnakeId) {
    activateAnySnakePlease();
  }
  if (object.type === BLOCK && paintBrushTileCode === BLOCK && paintBrushBlockId === object.id) {
    // no longer editing an object that doesn't exit
    paintBrushBlockId = null;
  }
  if (object.type === BLOCK) {
    delete blockSupportRenderCache[object.id];
  }
}
function removeFromArray(array, element) {
  var index = array.indexOf(element);
  if (index === -1) throw unreachable();
  array.splice(index, 1);
}
function findActiveSnake() {
  var snakes = getSnakes();
  for (var i = 0; i < snakes.length; i++) {
    if (snakes[i].id === activeSnakeId) return snakes[i];
  }
  throw unreachable();
}
function findBlockById(id) {
  return findObjectOfTypeAndId(BLOCK, id);
}
function findSnakesOfColor(color) {
  return level.objects.filter(function(object) {
    if (object.type !== SNAKE) return false;
    return object.id % snakeColors.length === color;
  });
}
function findObjectOfTypeAndId(type, id) {
  for (var i = 0; i < level.objects.length; i++) {
    var object = level.objects[i];
    if (object.type === type && object.id === id) return object;
  }
  return null;
}
function findObjectAtLocation(location) {
  for (var i = 0; i < level.objects.length; i++) {
    var object = level.objects[i];
    if (object.locations.indexOf(location) !== -1)
      return object;
  }
  return null;
}
function isUneatenFruit() {
  return getObjectsOfType(FRUIT).length + getObjectsOfType(POISONFRUIT).length > 0;
}
function getActivePortalLocations() {
  var portalLocations = getPortalLocations();
  if (portalLocations.length !== 2) return []; // nice try
  return portalLocations;
}
function getOccupiedOpenGateLocations()
{
  var result = [];
  for (var i = 0; i < level.map.length; i++) {
    if (level.map[i] === OPENGATE) {
      if (findObjectAtLocation(i))
          result.push(i);
    }
  }
  return result;
}
function getPortalLocations() {
  var result = [];
  for (var i = 0; i < level.map.length; i++) {
    if (level.map[i] === PORTAL) result.push(i);
  }
  return result;
}
function countSnakes() {
  return getSnakes().length;
}
function getSnakes() {
  return getObjectsOfType(SNAKE);
}
function getBlocks() {
  return getObjectsOfType(BLOCK);
}
function getObjectsOfType(type) {
  return level.objects.filter(function(object) {
    return object.type === type;
  });
}
function isDead() {
  if (animationQueue.length > 0 && animationQueue[animationQueue.length - 1][1][0] === INFINITE_LOOP) return true;
  return getSnakes().filter(function(snake) {
    return !!snake.dead;
  }).length > 0;
}
function isAlive() {
  return countSnakes() > 0 && !isDead();
}

var snakeColors = [
  "#f00",
  "#0f0",
  "#00f",
  "#ff0",
  "#f0f",
  "#0ff",
  "#80f",
  "#f80",
  "#000",
  "#fff",
];
var snakeColorNames = [
  "Red",
  "Green",
  "Blue",
  "Yellow",
  "Magenta",
  "Cyan",
  "Purple",
  "Orange",
  "Black",
  "White",
];
var blockForeground = ["#de5a6d","#fa65dd","#c367e3","#9c62fa","#625ff0","#79c13a","#ccbf4b","#e08645"];
var blockBackground = ["#853641","#963c84","#753d88","#5d3a96","#3a3990","#436b21","#756c2b","#8c532b"];


var activeSnakeId = null;

var SLITHER_HEAD = "sh";
var SLITHER_TAIL = "st";
var MOVE_SNAKE = "ms";
var MOVE_BLOCK = "mb";
var TELEPORT_SNAKE = "ts";
var TELEPORT_BLOCK = "tb";
var EXIT_SNAKE = "es";
var DIE_SNAKE = "ds";
var DIE_BLOCK = "db";
var INFINITE_LOOP = "il";
var animationQueue = [
  // // sequence of disjoint animation groups.
  // // each group completes before the next begins.
  // [
  //   70, // duration of this animation group
  //   // multiple things to animate simultaneously
  //   [
  //     SLITHER_HEAD | SLITHER_TAIL | MOVE_SNAKE | MOVE_BLOCK | TELEPORT_SNAKE | TELEPORT_BLOCK,
  //     objectId,
  //     dr,
  //     dc,
  //   ],
  //   [
  //     INFINITE_LOOP,
  //     loopSizeNotIncludingThis,
  //   ],
  // ],
];
var animationQueueCursor = 0;
var animationStart = null; // performance.now()
var animationProgress; // 0.0 <= x < 1.0
var freshlyRemovedAnimatedObjects = [];

// render the support beams for blocks into a temporary buffer, and remember it.
// this is due to stencil buffers causing slowdown on some platforms. see #25.
var blockSupportRenderCache = {
  // id: canvas,
  // "0": document.createElement("canvas"),
};

var gridPattern;

function render() {
  if (level == null) return;
  if (animationQueueCursor < animationQueue.length) {
    var animationDuration = animationQueue[animationQueueCursor][0];
    animationProgress = (performance.now() - animationStart) / animationDuration;
    while (animationProgress >= 1.0) {
      // animation group complete
      animationProgress -= 1.0;
      animationQueueCursor++;
      if (animationQueueCursor < animationQueue.length) {
        animationProgress *= animationDuration;
        animationDuration = animationQueue[animationQueueCursor][0];
        animationProgress /= animationDuration;
        if (animationQueue[animationQueueCursor][1][0] === INFINITE_LOOP) {
          var infiniteLoopSize = animationQueue[animationQueueCursor][1][1];
          animationQueueCursor -= infiniteLoopSize;
        }
      }
      animationStart = performance.now();
    }
  }
  if (animationQueueCursor > animationQueue.length) animationQueueCursor = animationQueue.length;
  if (animationQueueCursor === animationQueue.length) animationProgress = 1.0;
  canvas.width = tileSize * level.width;
  canvas.height = tileSize * level.height;
  var context = canvas.getContext("2d");
  context.fillStyle = "#88f"; // sky
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (persistentState.showGrid && !persistentState.showEditor) {
    drawGrid();
  }

  var activePortalLocations = getActivePortalLocations();

  // normal render
  renderLevel();

  // draw portal collision diagram
  if (Object.keys(portalCollisionMap).length > 0) {
    for (var key in portalCollisionMap) {
      var loc = parseInt(key);
      var {r, c} = getRowcol(level, loc);
      var collision = portalCollisionMap[key]
      drawPortalDiagram(r, c, "#ffffff");
      if (collision) {
        drawX(r, c, "rgba(256, 85, 85, 0.75)");
      }
    }
  }
  // draw indicator that both ends of the portal were touched at the same time
  if (portalsBlocked) {
    var portalLocs = getPortalLocations();
    var rowcol1 = getRowcol(level, portalLocs[0]);
    var rowcol2 = getRowcol(level, portalLocs[1]);
    drawX(rowcol1.r, rowcol1.c, "rgba(256, 85, 85, 0.75)");
    drawX(rowcol2.r, rowcol2.c, "rgba(256, 85, 85, 0.75)");
  }

  if (persistentState.showGrid && persistentState.showEditor) {
    drawGrid();
  }
  // active snake halo
  if (countSnakes() !== 0 && isAlive()) {
    var activeSnake = findActiveSnake();
    var activeSnakeRowcol = getRowcol(level, activeSnake.locations[0]);
    drawCircle(activeSnakeRowcol.r, activeSnakeRowcol.c, 2, "rgba(256,256,256,0.3)");
  }

  if (persistentState.showEditor) {
    if (paintBrushTileCode === BLOCK) {
      if (paintBrushBlockId != null) {
        // fade everything else away
        context.fillStyle = "rgba(0, 0, 0, 0.8)";
        context.fillRect(0, 0, canvas.width, canvas.height);
        // and render just this object in focus
        var activeBlock = findBlockById(paintBrushBlockId);
        renderLevel([activeBlock]);
      }
    } else if (paintBrushTileCode === "select") {
      getSelectedLocations().forEach(function(location) {
        var rowcol = getRowcol(level, location);
        drawRect(rowcol.r, rowcol.c, "rgba(128, 128, 128, 0.3)");
      });
    }
  }

  // serialize
  if (!isDead()) {
    var serialization = stringifyLevel(level);
    document.getElementById("serializationTextarea").value = serialization;
    var link = location.href.substring(0, location.href.length - location.hash.length);
    link += "#level=" + compressSerialization(serialization);
    document.getElementById("shareLinkTextbox").value = link;
  }

  // throw this in there somewhere
  document.getElementById("showGridButton").textContent = (persistentState.showGrid ? "Hide" : "Show") + " Grid";

  if (animationProgress < 1.0) requestAnimationFrame(render);
  return; // this is the end of the function proper

  function renderLevel(onlyTheseObjects) {
    var objects = level.objects;
    if (onlyTheseObjects != null) {
      objects = onlyTheseObjects;
    } else {
      objects = level.objects.concat(freshlyRemovedAnimatedObjects.filter(function(object) {
        // the object needs to have a future removal animation, or else, it's gone already.
        return hasFutureRemoveAnimation(object);
      }));
    }
    // begin by rendering the background connections for blocks
    objects.forEach(function(object) {
      if (object.type !== BLOCK) return;
      var animationDisplacementRowcol = findAnimationDisplacementRowcol(object.type, object.id);
      var minR = Infinity;
      var maxR = -Infinity;
      var minC = Infinity;
      var maxC = -Infinity;
      object.locations.forEach(function(location) {
        var rowcol = getRowcol(level, location);
        if (rowcol.r < minR) minR = rowcol.r;
        if (rowcol.r > maxR) maxR = rowcol.r;
        if (rowcol.c < minC) minC = rowcol.c;
        if (rowcol.c > maxC) maxC = rowcol.c;
      });
      var image = blockSupportRenderCache[object.id];
      if (image == null) {
        // render the support beams to a buffer
        blockSupportRenderCache[object.id] = image = document.createElement("canvas");
        image.width  = (maxC - minC + 1) * tileSize;
        image.height = (maxR - minR + 1) * tileSize;
        var bufferContext = image.getContext("2d");
        // Make a stencil that excludes the insides of blocks.
        // Then when we render the support beams, we won't see the supports inside the block itself.
        bufferContext.beginPath();
        // Draw a path around the whole screen in the opposite direction as the rectangle paths below.
        // This means that the below rectangles will be removing area from the greater rectangle.
        bufferContext.rect(image.width, 0, -image.width, image.height);
        for (var i = 0; i < object.locations.length; i++) {
          var rowcol = getRowcol(level, object.locations[i]);
          var r = rowcol.r - minR;
          var c = rowcol.c - minC;
          bufferContext.rect(c * tileSize, r * tileSize, tileSize, tileSize);
        }
        bufferContext.clip();
        for (var i = 0; i < object.locations.length - 1; i++) {
          var rowcol1 = getRowcol(level, object.locations[i]);
          rowcol1.r -= minR;
          rowcol1.c -= minC;
          var rowcol2 = getRowcol(level, object.locations[i + 1]);
          rowcol2.r -= minR;
          rowcol2.c -= minC;
          var cornerRowcol = {r:rowcol1.r, c:rowcol2.c};
          drawConnector(bufferContext, rowcol1.r, rowcol1.c, cornerRowcol.r, cornerRowcol.c, blockBackground[object.id % blockBackground.length]);
          drawConnector(bufferContext, rowcol2.r, rowcol2.c, cornerRowcol.r, cornerRowcol.c, blockBackground[object.id % blockBackground.length]);
        }
      }
      var r = minR + animationDisplacementRowcol.r;
      var c = minC + animationDisplacementRowcol.c;
      context.drawImage(image, c * tileSize, r * tileSize);
    });

    // terrain
    if (onlyTheseObjects == null) {
      for (var r = 0; r < level.height; r++) {
        for (var c = 0; c < level.width; c++) {
          var location = getLocation(level, r, c);
          var tileCode = level.map[location];
          drawTile(tileCode, r, c, level, location);
        }
      }
    }

    // objects
    objects.forEach(drawObject);

    // banners
    if (countSnakes() === 0) {
      context.fillStyle = "#ff0";
      context.textBaseline = "middle";
      context.textAlign = "center";
      context.font = 64 * (Math.sqrt(canvas.width / 64 + 4) - 2) + "px Arial";
      context.fillText("You Win!", canvas.width / 2, canvas.height / 2);
    }
    else if (isDead()) {
      context.fillStyle = "#f00";
      context.textBaseline = "middle";
      context.textAlign = "center";
      context.font = 64 * (Math.sqrt(canvas.width / 64 + 4) - 2) + "px Arial";
      context.fillText("You Dead!", canvas.width / 2, canvas.height / 2);
    }

    // editor hover
    if (persistentState.showEditor && paintBrushTileCode != null && hoverLocation != null && hoverLocation < level.map.length) {

      var savedContext = context;
      var hoverAlpha = 0.2;
      var buffer = document.createElement("canvas");
      buffer.width = canvas.width;
      buffer.height = canvas.height;
      context = buffer.getContext("2d");

      var hoverRowcol = getRowcol(level, hoverLocation);
      var objectHere = findObjectAtLocation(hoverLocation);
      if (typeof paintBrushTileCode === "number") {
        if (level.map[hoverLocation] !== paintBrushTileCode) {
          drawTile(paintBrushTileCode, hoverRowcol.r, hoverRowcol.c, level, hoverLocation);
          switch (paintBrushTileCode) {
            // make some tiles bolder
            case PLATFORM: case PLATFORMU: case PLATFORMD: case PLATFORML: case PLATFORMR: case WOODPLATFORM: case OPENGATE: case CLOSEDGATE:
              hoverAlpha = 0.4; break;
            default:
              hoverAlpha = 0.2; break;
          }
        }
      } else if (paintBrushTileCode === SNAKE) {
        if (!(objectHere != null && objectHere.type === SNAKE && objectHere.id === paintBrushSnakeColorIndex)) {
          drawObject(newSnake(paintBrushSnakeColorIndex, hoverLocation));
        }
      } else if (paintBrushTileCode === BLOCK) {
        if (!(objectHere != null && objectHere.type === BLOCK && objectHere.id === paintBrushBlockId)) {
          drawObject(newBlock(hoverLocation));
        }
      } else if (paintBrushTileCode === FRUIT) {
        if (!(objectHere != null && objectHere.type === FRUIT)) {
          drawObject(newFruit(hoverLocation));
        }
      } else if (paintBrushTileCode === POISONFRUIT) {
        if (!(objectHere != null && objectHere.type === POISONFRUIT)) {
          drawObject(newPoisonFruit(hoverLocation));
        }
      } else if (paintBrushTileCode === "resizeU") {
        void 0; // do nothing
      } else if (paintBrushTileCode === "resizeD") {
        void 0; // do nothing
      } else if (paintBrushTileCode === "select") {
        void 0; // do nothing
      } else if (paintBrushTileCode === "paste") {
        // show what will be pasted if you click
        var pastedData = previewPaste(hoverRowcol.r, hoverRowcol.c);
        pastedData.selectedLocations.forEach(function(location) {
          var tileCode = pastedData.level.map[location];
          var rowcol = getRowcol(level, location);
          drawTile(tileCode, rowcol.r, rowcol.c, pastedData.level, location);
        });
        pastedData.selectedObjects.forEach(drawObject);
      } else throw unreachable();

      context = savedContext;
      context.save();
      context.globalAlpha = hoverAlpha;
      context.drawImage(buffer, 0, 0);
      context.restore();
    }
  }
  function drawTile(tileCode, r, c, level, location) {
    switch (tileCode) {
      case SPACE:
        break;
      case WALL:
        drawWall(r, c, getAdjacentTiles());
        break;
      case SPIKE:
        drawSpikes(r, c, getAdjacentTiles());
        break;
      case EXIT:
        var radiusFactor = isUneatenFruit() ? 0.7 : 1.2;
        drawQuarterPie(r, c, radiusFactor, "#f00", 0);
        drawQuarterPie(r, c, radiusFactor, "#0f0", 1);
        drawQuarterPie(r, c, radiusFactor, "#00f", 2);
        drawQuarterPie(r, c, radiusFactor, "#ff0", 3);
        break;
      case PORTAL:
        drawCircle(r, c, 0.8, "#888");
        drawCircle(r, c, 0.6, "#111");
        if (activePortalLocations.indexOf(location) !== -1) drawCircle(r, c, 0.3, "#666");
        break;
      case PLATFORM:
        drawPlatform(r, c, -1, 0);
        break;
      case PLATFORMU:
        drawPlatform(r, c, -1, 0);
        break;
      case PLATFORMD:
        drawPlatform(r, c, 1, 0);
        break;
      case PLATFORML:
        drawPlatform(r, c, 0, -1);
        break;
      case PLATFORMR:
        drawPlatform(r, c, 0, 1);
        break;
      case WOODPLATFORM:
        drawOneWayWall("#D38345", r, c, -1, 0, getAdjacentTiles());
        break;
      case FOAM:
        drawFoam(r, c);
        break;
      case DIGGABLEDIRT:
        drawDiggableDirt(r, c);
        break;
      case OPENGATE:
        drawGate(r, c, false);
        break;
      case CLOSEDGATE:
        drawGate(r, c, true);
        break;
      default: throw unreachable();
    }
    function getAdjacentTiles() {
      return [
        [getTile(r - 1, c - 1),
         getTile(r - 1, c + 0),
         getTile(r - 1, c + 1)],
        [getTile(r + 0, c - 1),
         null,
         getTile(r + 0, c + 1)],
        [getTile(r + 1, c - 1),
         getTile(r + 1, c + 0),
         getTile(r + 1, c + 1)],
      ];
    }
    function getTile(r, c) {
      if (!isInBounds(level, r, c)) return null;
      return level.map[getLocation(level, r, c)];
    }
  }

  function drawObject(object) {
    switch (object.type) {
      case SNAKE:
        var animationDisplacementRowcol = findAnimationDisplacementRowcol(object.type, object.id);
        var lastRowcol = null
        var color = snakeColors[object.id % snakeColors.length];
        var headRowcol;
        for (var i = 0; i <= object.locations.length; i++) {
          var animation;
          var rowcol;
          if (i === 0 && (animation = findAnimation([SLITHER_HEAD], object.id)) != null) {
            // animate head slithering forward
            rowcol = getRowcol(level, object.locations[i]);
            rowcol.r += animation[2] * (animationProgress - 1);
            rowcol.c += animation[3] * (animationProgress - 1);
          } else if (i === object.locations.length) {
            // animated tail?
            if ((animation = findAnimation([SLITHER_TAIL], object.id)) != null) {
              // animate tail slithering to catch up
              rowcol = getRowcol(level, object.locations[i - 1]);
              rowcol.r += animation[2] * (animationProgress - 1);
              rowcol.c += animation[3] * (animationProgress - 1);
            } else {
              // no animated tail needed
              break;
            }
          } else {
            rowcol = getRowcol(level, object.locations[i]);
          }
          if (object.dead) rowcol.r += 0.5;
          rowcol.r += animationDisplacementRowcol.r;
          rowcol.c += animationDisplacementRowcol.c;
          if (i === 0) {
            // head
            headRowcol = rowcol;
            drawDiamond(rowcol.r, rowcol.c, color);
          } else {
            // middle
            var cx = (rowcol.c + 0.5) * tileSize;
            var cy = (rowcol.r + 0.5) * tileSize;
            context.fillStyle = color;
            var orientation;
            if (lastRowcol.r < rowcol.r) {
              orientation = 0;
              context.beginPath();
              context.moveTo((lastRowcol.c + 0) * tileSize, (lastRowcol.r + 0.5) * tileSize);
              context.lineTo((lastRowcol.c + 1) * tileSize, (lastRowcol.r + 0.5) * tileSize);
              context.arc(cx, cy, tileSize/2, 0, Math.PI);
              context.fill();
            } else if (lastRowcol.r > rowcol.r) {
              orientation = 2;
              context.beginPath();
              context.moveTo((lastRowcol.c + 1) * tileSize, (lastRowcol.r + 0.5) * tileSize);
              context.lineTo((lastRowcol.c + 0) * tileSize, (lastRowcol.r + 0.5) * tileSize);
              context.arc(cx, cy, tileSize/2, Math.PI, 0);
              context.fill();
            } else if (lastRowcol.c < rowcol.c) {
              orientation = 3;
              context.beginPath();
              context.moveTo((lastRowcol.c + 0.5) * tileSize, (lastRowcol.r + 1) * tileSize);
              context.lineTo((lastRowcol.c + 0.5) * tileSize, (lastRowcol.r + 0) * tileSize);
              context.arc(cx, cy, tileSize/2, 1.5 * Math.PI, 2.5 * Math.PI);
              context.fill();
            } else if (lastRowcol.c > rowcol.c) {
              orientation = 1;
              context.beginPath();
              context.moveTo((lastRowcol.c + 0.5) * tileSize, (lastRowcol.r + 0) * tileSize);
              context.lineTo((lastRowcol.c + 0.5) * tileSize, (lastRowcol.r + 1) * tileSize);
              context.arc(cx, cy, tileSize/2, 2.5 * Math.PI, 1.5 * Math.PI);
              context.fill();
            }
          }
          lastRowcol = rowcol;
        }
        // eye
        if (object.id === activeSnakeId) {
          drawCircle(headRowcol.r, headRowcol.c, 0.5, "#fff");
          drawCircle(headRowcol.r, headRowcol.c, 0.2, "#000");
        }
        break;
      case BLOCK:
        drawBlock(object);
        break;
      case FRUIT:
        var rowcol = getRowcol(level, object.locations[0]);
        drawCircle(rowcol.r, rowcol.c, 1, "#f0f");
        break;
      case POISONFRUIT:
        var rowcol = getRowcol(level, object.locations[0]);
        drawCircle(rowcol.r, rowcol.c, 1, "#570");
        break;
      default: throw unreachable();
    }
  }

  function drawOneWayWall(fillStyle, r, c, dr, dc, adjacentTiles) {
    var extendTop    = adjacentTiles[0][1] === SPACE || adjacentTiles[0][1] === WOODPLATFORM || adjacentTiles[0][1] === PLATFORMU ? tileSize/15 : 0;
    var extendLeft   = adjacentTiles[1][0] === SPACE ? tileSize/15 : 0;
    var extendBottom = adjacentTiles[2][1] === SPACE ? tileSize/15 : 0;
    var extendRight  = adjacentTiles[1][2] === SPACE ? tileSize/15 : 0;
    context.fillStyle = fillStyle;

    if (dr === -1)
    {
      context.fillRect(c * tileSize - extendLeft, r * tileSize, tileSize + extendLeft + extendRight, 4*tileSize/15);
    }
    else if (dr === 1)
    {
      context.fillRect(c * tileSize - extendLeft, (r + 1) * tileSize - 4*tileSize/15, tileSize + extendLeft + extendRight, 4*tileSize/15);
    }
    else if (dc === -1)
    {
      context.fillRect(c * tileSize, r * tileSize - extendTop, 4*tileSize/15, tileSize + extendTop + extendBottom);
    }
    else if (dc === 1)
    {
      context.fillRect((c + 1) * tileSize - 4*tileSize/15, r * tileSize - extendTop, 4*tileSize/15, tileSize + extendTop + extendBottom);
    }

    context.lineWidth = 3;
    context.strokeStyle = "#777";
    context.beginPath();

    if (dr === -1)
    {
      if (adjacentTiles[1][0] !== WOODPLATFORM) {
        context.moveTo(c * tileSize, r * tileSize + tileSize/2);
        context.lineTo(c * tileSize + tileSize/4, r * tileSize + tileSize/4);
      }
      if (adjacentTiles[1][2] !== WOODPLATFORM) {
        context.moveTo(c * tileSize + 3*tileSize/4, r * tileSize + tileSize/4);
        context.lineTo(c * tileSize + tileSize, r * tileSize + tileSize/2);
      }
    }
    else if (dr === 1)
    {
      context.moveTo(c * tileSize, r * tileSize + tileSize/2);
      context.lineTo(c * tileSize + tileSize/4, r * tileSize + 3*tileSize/4);
      context.moveTo(c * tileSize + 3*tileSize/4, r * tileSize + 3*tileSize/4);
      context.lineTo(c * tileSize + tileSize, r * tileSize + tileSize/2);
    }
    else if (dc === -1)
    {
      context.moveTo(c * tileSize + tileSize/2, r * tileSize);
      context.lineTo(c * tileSize + tileSize/4, r * tileSize + tileSize/4);
      context.moveTo(c * tileSize + tileSize/4, r * tileSize + 3*tileSize/4);
      context.lineTo(c * tileSize + tileSize/2, r * tileSize + tileSize);
    }
    else if (dc === 1)
    {
      context.moveTo(c * tileSize + tileSize/2, r * tileSize);
      context.lineTo(c * tileSize + 3*tileSize/4, r * tileSize + tileSize/4);
      context.moveTo(c * tileSize + 3*tileSize/4, r * tileSize + 3*tileSize/4);
      context.lineTo(c * tileSize + tileSize/2, r * tileSize + tileSize);
    }

    context.stroke();
    context.lineWidth = 0;
  }

  function drawFoam(r, c) {
    context.fillStyle = "#6BDBC8";
    for (var i = 0; i < 3; i++) {
      for (var j = 0; j < 3; j++) {
        context.beginPath();
        context.arc(c*tileSize + (i*2+1)*tileSize/6, r*tileSize + (j*2+1)*tileSize/6, tileSize/6, 0, 2*Math.PI);
        context.fill();
      }
    }
  }

  function drawDiggableDirt(r, c) {
    drawRect(r, c, "#d37c2a");
    context.fillStyle = "#844204";
    context.beginPath();
    context.moveTo(c*tileSize + tileSize/2, r*tileSize);
    context.lineTo((c+1)*tileSize, r*tileSize + tileSize/2);
    context.lineTo(c*tileSize + tileSize/2, (r+1)*tileSize);
    context.lineTo(c*tileSize, r*tileSize + tileSize/2);
    context.lineTo(c*tileSize + tileSize/2, r*tileSize);
    context.fill();
  }

  function drawGate(r, c, isClosed) {
    if (isClosed)
    {
      context.fillStyle = "#444";
      context.beginPath();
      for (var i = 9; i <= 18; i += 9) {
        context.moveTo((c + i/30)*tileSize, r*tileSize);
        context.lineTo((c + (i+3)/30)*tileSize, r*tileSize);
        context.lineTo((c + (i+3)/30)*tileSize, (r+1)*tileSize);
        context.lineTo((c + i/30) * tileSize, (r+1)*tileSize);
        context.lineTo((c + i/30)*tileSize, r*tileSize);
      }
      for (var i = 9; i <= 23; i += 7) {
        context.moveTo(c*tileSize, (r + i/30)*tileSize);
        context.lineTo((c+1) * tileSize, (r + i/30)*tileSize);
        context.lineTo((c+1)*tileSize, (r + (i+3)/30)*tileSize);
        context.lineTo(c*tileSize, (r + (i+3)/30)*tileSize);
        context.lineTo(c*tileSize, (r + i/30)*tileSize);
      }
      context.fill();
    }

    context.fillStyle = "#777";
    context.beginPath();
    context.moveTo(c*tileSize, r*tileSize);
    context.lineTo((c+1)*tileSize, r*tileSize);
    context.lineTo((c+1)*tileSize, (r+1)*tileSize);
    context.lineTo(c*tileSize + 5*tileSize/6, (r+1)*tileSize);
    context.lineTo(c*tileSize + 5*tileSize/6, r*tileSize + tileSize/2);
    context.arc(c*tileSize + tileSize/2, r*tileSize + tileSize/2, tileSize/3, 0, Math.PI, true);
    context.lineTo(c*tileSize + 1*tileSize/6, (r+1)*tileSize);
    context.lineTo(c*tileSize, (r+1)*tileSize);
    context.lineTo(c*tileSize, r*tileSize);
    context.fill();
  }

  function drawWall(r, c, adjacentTiles) {
    drawRect(r, c, "#844204"); // dirt
    context.fillStyle = "#282"; // grass
    drawTileOutlines(r, c, isWall, 0.2);

    function isWall(dc, dr) {
      var tileCode = adjacentTiles[1 + dr][1 + dc];
      return tileCode == null || tileCode === WALL;
    }
  }
  function drawTileOutlines(r, c, isOccupied, outlineThickness) {
    var complement = 1 - outlineThickness;
    var outlinePixels = outlineThickness * tileSize;
    var complementPixels = (1 - 2 * outlineThickness) * tileSize;
    if (!isOccupied(-1, -1)) context.fillRect((c)            * tileSize, (r)            * tileSize, outlinePixels, outlinePixels);
    if (!isOccupied( 1, -1)) context.fillRect((c+complement) * tileSize, (r)            * tileSize, outlinePixels, outlinePixels);
    if (!isOccupied(-1,  1)) context.fillRect((c)            * tileSize, (r+complement) * tileSize, outlinePixels, outlinePixels);
    if (!isOccupied( 1,  1)) context.fillRect((c+complement) * tileSize, (r+complement) * tileSize, outlinePixels, outlinePixels);
    if (!isOccupied( 0, -1)) context.fillRect((c)            * tileSize, (r)            * tileSize, tileSize, outlinePixels);
    if (!isOccupied( 0,  1)) context.fillRect((c)            * tileSize, (r+complement) * tileSize, tileSize, outlinePixels);
    if (!isOccupied(-1,  0)) context.fillRect((c)            * tileSize, (r)            * tileSize, outlinePixels, tileSize);
    if (!isOccupied( 1,  0)) context.fillRect((c+complement) * tileSize, (r)            * tileSize, outlinePixels, tileSize);
  }
  function drawSpikes(r, c, adjacentTiles) {
    var connectU, connectD, connectL, connectR = false;
    var spikeU = adjacentTiles[0][1] === SPIKE;
    var spikeD = adjacentTiles[2][1] === SPIKE;
    var spikeL = adjacentTiles[1][0] === SPIKE;
    var spikeR = adjacentTiles[1][2] === SPIKE;
    var wallU = adjacentTiles[0][1] === WALL;
    var wallD = adjacentTiles[2][1] === WALL;
    var wallL = adjacentTiles[1][0] === WALL;
    var wallR = adjacentTiles[1][2] === WALL;
    var wallUL = wallU && (adjacentTiles[0][0] === WALL || adjacentTiles[0][0] == null);
    var wallUR = wallU && (adjacentTiles[0][2] === WALL || adjacentTiles[0][2] == null);
    var wallDL = wallD && (adjacentTiles[2][0] === WALL || adjacentTiles[2][0] == null);
    var wallDR = wallD && (adjacentTiles[2][2] === WALL || adjacentTiles[2][2] == null);
    var wallLU = wallL && (adjacentTiles[0][0] === WALL || adjacentTiles[0][0] == null);
    var wallLD = wallL && (adjacentTiles[2][0] === WALL || adjacentTiles[2][0] == null);
    var wallRU = wallR && (adjacentTiles[0][2] === WALL || adjacentTiles[0][2] == null);
    var wallRD = wallR && (adjacentTiles[2][2] === WALL || adjacentTiles[2][2] == null);
    var solidUL = wallUL || adjacentTiles[0][0] === SPIKE;
    var solidUR = wallUR || adjacentTiles[0][2] === SPIKE;
    var solidDL = wallDL || adjacentTiles[2][0] === SPIKE;
    var solidDR = wallDR || adjacentTiles[2][2] === SPIKE;
    var solidLU = wallLU || adjacentTiles[0][0] === SPIKE;
    var solidLD = wallLD || adjacentTiles[2][0] === SPIKE;
    var solidRU = wallRU || adjacentTiles[0][2] === SPIKE;
    var solidRD = wallRD || adjacentTiles[2][2] === SPIKE;
    switch (0 + spikeU + spikeD + spikeL + spikeR + (spikeU && spikeD) + (spikeL && spikeR)) {
      case 0: { // no adjacent spikes
        // connect to each continuous wall, prefer vertical for single and horizontal for multiple
        // connectU = wallU && (!(wallLU ^ wallRU) || !wallDL && !wallR || !wallDR && !wallL); // connects in fully surrounded case
        // connectD = wallD && (!(wallLD ^ wallRD) || !wallUL && !wallR || !wallUR && !wallL);
        connectU = wallU && (!wallLU && !wallRU || !wallDL && !wallR || !wallDR && !wallL || wallLU && wallRU && !(wallDL && wallDR));
        connectD = wallD && (!wallLD && !wallRD || !wallUL && !wallR || !wallUR && !wallL || wallLD && wallRD && !(wallUL && wallUR));
        connectL = wallL && !(wallUL && (wallRU || connectU) || wallDL && (wallRD || connectD));
        connectR = wallR && !(wallUR && (wallLU || connectU) || wallDR && (wallLD || connectD));
        break;
      }
      case 1: { // one adjacent spike
        // connect straight across if possible, otherwise to sides
        connectU = wallU && (spikeD || spikeL && !wallR || spikeR && !wallL);
        connectD = wallD && (spikeU || spikeL && !wallR || spikeR && !wallL);
        connectL = wallL && (spikeR || spikeU && !wallD || spikeD && !wallU);
        connectR = wallR && (spikeL || spikeU && !wallD || spikeD && !wallU);
        break;
      }
      case 2: { // two adjacent spikes in L
        // detect enclosed wall connections or 2x2 spike squares
        var enclosedU = wallL && solidUR || wallR && solidUL;
        var enclosedD = wallL && solidDR || wallR && solidDL;
        var enclosedL = wallU && solidLD || wallD && solidLU;
        var enclosedR = wallU && solidRD || wallD && solidRU;
        // connect to unenclosed wall ends or mid-wall spike squares
        connectU = wallU && !(enclosedU || spikeL && wallUR && solidUL && !enclosedL || spikeR && wallUL && solidUR && !enclosedR);
        connectD = wallD && !(enclosedD || spikeL && wallDR && solidDL && !enclosedL || spikeR && wallDL && solidDR && !enclosedR);
        connectL = wallL && !(enclosedL || spikeU && wallLD && solidLU && !enclosedU || spikeD && wallLU && solidLD && !enclosedD || connectU || connectD);
        connectR = wallR && !(enclosedR || spikeU && wallRD && solidRU && !enclosedU || spikeD && wallRU && solidRD && !enclosedD || connectU || connectD);
        break;
      }
      case 3: { // two adjacent opposite spikes
        // connect to single walls
        connectU = wallU && !(wallUL || wallUR || adjacentTiles[0][0] === SPIKE && adjacentTiles[0][2] === SPIKE);
        connectD = wallD && !(wallDL || wallDR || adjacentTiles[2][0] === SPIKE && adjacentTiles[2][2] === SPIKE);
        connectL = wallL && !(wallLU || wallLD || adjacentTiles[0][0] === SPIKE && adjacentTiles[2][0] === SPIKE);
        connectR = wallR && !(wallRU || wallRD || adjacentTiles[0][2] === SPIKE && adjacentTiles[2][2] === SPIKE);
        break;
      }
      case 4: { // three adjacent spikes
        // connect to single walls or double walls with no opposite spike
        connectU = wallU && !(solidUL && solidUR || wallUL && adjacentTiles[2][0] === SPIKE || wallUR && adjacentTiles[2][2] === SPIKE);
        connectD = wallD && !(solidDL && solidDR || wallDL && adjacentTiles[0][0] === SPIKE || wallDR && adjacentTiles[0][2] === SPIKE);
        connectL = wallL && !(solidLU && solidLD || wallLU && adjacentTiles[0][2] === SPIKE || wallLD && adjacentTiles[2][2] === SPIKE);
        connectR = wallR && !(solidRU && solidRD || wallRU && adjacentTiles[0][0] === SPIKE || wallRD && adjacentTiles[2][0] === SPIKE);
        break;
      }
      default: break;
    }

    var x = c * tileSize;
    var y = r * tileSize;
    context.fillStyle = "#333";
    context.beginPath();
    context.moveTo(x + tileSize * 0.3, y + tileSize * 0.3);
    if (spikeU || connectU) {
      context.lineTo(x + tileSize * 0.3, y + tileSize * 0.0);
      context.lineTo(x + tileSize * 0.7, y + tileSize * 0.0);
    } else {
      context.lineTo(x + tileSize * 0.4, y + tileSize * 0.0);
      context.lineTo(x + tileSize * 0.5, y + tileSize * 0.3);
      context.lineTo(x + tileSize * 0.6, y + tileSize * 0.0);
    }
    context.lineTo(x + tileSize * 0.7, y + tileSize * 0.3);
    if (spikeR || connectR) {
      context.lineTo(x + tileSize * 1.0, y + tileSize * 0.3);
      context.lineTo(x + tileSize * 1.0, y + tileSize * 0.7);
    } else {
      context.lineTo(x + tileSize * 1.0, y + tileSize * 0.4);
      context.lineTo(x + tileSize * 0.7, y + tileSize * 0.5);
      context.lineTo(x + tileSize * 1.0, y + tileSize * 0.6);
    }
    context.lineTo(x + tileSize * 0.7, y + tileSize * 0.7);
    if (spikeD || connectD) {
      context.lineTo(x + tileSize * 0.7, y + tileSize * 1.0);
      context.lineTo(x + tileSize * 0.3, y + tileSize * 1.0);
    } else {
      context.lineTo(x + tileSize * 0.6, y + tileSize * 1.0);
      context.lineTo(x + tileSize * 0.5, y + tileSize * 0.7);
      context.lineTo(x + tileSize * 0.4, y + tileSize * 1.0);
    }
    context.lineTo(x + tileSize * 0.3, y + tileSize * 0.7);
    if (spikeL || connectL) {
      context.lineTo(x + tileSize * 0.0, y + tileSize * 0.7);
      context.lineTo(x + tileSize * 0.0, y + tileSize * 0.3);
    } else {
      context.lineTo(x + tileSize * 0.0, y + tileSize * 0.6);
      context.lineTo(x + tileSize * 0.3, y + tileSize * 0.5);
      context.lineTo(x + tileSize * 0.0, y + tileSize * 0.4);
    }
    context.lineTo(x + tileSize * 0.3, y + tileSize * 0.3);
    context.fill();
  }
  function drawPlatform(r, c, dr, dc) {
    context.fillStyle = "#b9733d";
    context.beginPath();
    if (dr === -1)
    {
      context.moveTo(c * tileSize, r * tileSize);
      context.lineTo((c + 1) * tileSize, r * tileSize);
      context.arc((c + 3/4) * tileSize, (r + 1/4) * tileSize, tileSize/4, 0, Math.PI);
      context.arc((c + 1/4) * tileSize, (r + 1/4) * tileSize, tileSize/4, 0, Math.PI);
    }
    else if (dr === 1)
    {
      context.moveTo((c + 1) * tileSize, (r + 1) * tileSize);
      context.lineTo(c * tileSize, (r + 1) * tileSize);
      context.arc((c + 1/4) * tileSize, (r + 3/4) * tileSize, tileSize/4, Math.PI, 0);
      context.arc((c + 3/4) * tileSize, (r + 3/4) * tileSize, tileSize/4, Math.PI, 0);
    }
    else if (dc === -1)
    {
      context.moveTo(c * tileSize, (r + 1) * tileSize);
      context.lineTo(c * tileSize, r * tileSize);
      context.arc((c + 1/4) * tileSize, (r + 1/4) * tileSize, tileSize/4, -Math.PI/2, Math.PI/2);
      context.arc((c + 1/4) * tileSize, (r + 3/4) * tileSize, tileSize/4, -Math.PI/2, Math.PI/2);
    }
    else if (dc === 1)
    {
      context.moveTo((c + 1) * tileSize, r * tileSize);
      context.lineTo((c + 1) * tileSize, (r + 1) * tileSize);
      context.arc((c + 3/4) * tileSize, (r + 3/4) * tileSize, tileSize/4, Math.PI/2, -Math.PI/2);
      context.arc((c + 3/4) * tileSize, (r + 1/4) * tileSize, tileSize/4, Math.PI/2, -Math.PI/2);
    }
    context.fill();
  }
  function drawConnector(context, r1, c1, r2, c2, color) {
    // either r1 and r2 or c1 and c2 must be equal
    if (r1 > r2 || c1 > c2) {
      var rTmp = r1;
      var cTmp = c1;
      r1 = r2;
      c1 = c2;
      r2 = rTmp;
      c2 = cTmp;
    }
    var xLo = (c1 + 0.4) * tileSize;
    var yLo = (r1 + 0.4) * tileSize;
    var xHi = (c2 + 0.6) * tileSize;
    var yHi = (r2 + 0.6) * tileSize;
    context.fillStyle = color;
    context.fillRect(xLo, yLo, xHi - xLo, yHi - yLo);
  }
  function drawBlock(block) {
    var animationDisplacementRowcol = findAnimationDisplacementRowcol(block.type, block.id);
    var rowcols = block.locations.map(function(location) {
      return getRowcol(level, location);
    });
    rowcols.forEach(function(rowcol) {
      var r = rowcol.r + animationDisplacementRowcol.r;
      var c = rowcol.c + animationDisplacementRowcol.c;
      context.fillStyle = blockForeground[block.id % blockForeground.length];
      drawTileOutlines(r, c, isAlsoThisBlock, 0.3);
      function isAlsoThisBlock(dc, dr) {
        for (var i = 0; i < rowcols.length; i++) {
          var otherRowcol = rowcols[i];
          if (rowcol.r + dr === otherRowcol.r && rowcol.c + dc === otherRowcol.c) return true;
        }
        return false;
      }
    });
  }
  function drawQuarterPie(r, c, radiusFactor, fillStyle, quadrant) {
    var cx = (c + 0.5) * tileSize;
    var cy = (r + 0.5) * tileSize;
    context.fillStyle = fillStyle;
    context.beginPath();
    context.moveTo(cx, cy);
    context.arc(cx, cy, radiusFactor * tileSize/2, quadrant * Math.PI/2, (quadrant + 1) * Math.PI/2);
    context.fill();
  }
  function drawDiamond(r, c, fillStyle) {
    var x = c * tileSize;
    var y = r * tileSize;
    context.fillStyle = fillStyle;
    context.beginPath();
    context.moveTo(x + tileSize/2, y);
    context.lineTo(x + tileSize, y + tileSize/2);
    context.lineTo(x + tileSize/2, y + tileSize);
    context.lineTo(x, y + tileSize/2);
    context.lineTo(x + tileSize/2, y);
    context.fill();
  }
  function drawCircle(r, c, radiusFactor, fillStyle) {
    context.fillStyle = fillStyle;
    context.beginPath();
    context.arc((c + 0.5) * tileSize, (r + 0.5) * tileSize, tileSize/2 * radiusFactor, 0, 2*Math.PI);
    context.fill();
  }
  function drawRect(r, c, fillStyle) {
    context.fillStyle = fillStyle;
    context.fillRect(c * tileSize, r * tileSize, tileSize, tileSize);
  }
  function drawPoly(r, c, points) {
    var x = r * tileSize;
    var y = c * tileSize;
    context.moveTo(y + points[0][1] * tileSize, x + points[0][0] * tileSize);
    for (var i = 1; i < points.length; i++) {
      context.lineTo(y + points[i][1] * tileSize, x + points[i][0] * tileSize);
    }
  }
  function drawPortalDiagram(r, c, fillStyle) {
    var cornerLU = [
      [-1/30, -1/30], [4/30, -1/30], [4/30, 1/30], [1/30, 1/30],
      [1/30, 4/30], [-1/30, 4/30], [-1/30, -1/30]
    ];
    var cornerLD = cornerLU.map(function(p) { return [1 - p[0], p[1]]; });     // Mirror Y
    var cornerRU = cornerLU.map(function(p) { return [p[0], 1 - p[1]]; });     // Mirror X
    var cornerRD = cornerLU.map(function(p) { return [1 - p[0], 1 - p[1]]; }); // Mirror X & Y

    var sideL = [[12/30, -1/30], [18/30, -1/30], [18/30, 1/30], [12/30, 1/30], [12/30, -1/30]];
    var sideR = sideL.map(function(p) { return [p[0], 1 - p[1]]; }); // Mirror X
    var sideU = sideL.map(function(p) { return [p[1], p[0]]; });     // Swap X & Y
    var sideD = sideL.map(function(p) { return [1 - p[1], p[0]]; }); // Mirror X, swap X & Y

    context.beginPath();
    drawPoly(r, c, cornerLU);
    drawPoly(r, c, cornerLD);
    drawPoly(r, c, cornerRU);
    drawPoly(r, c, cornerRD);
    drawPoly(r, c, sideL);
    drawPoly(r, c, sideR);
    drawPoly(r, c, sideU);
    drawPoly(r, c, sideD);
    context.fillStyle = fillStyle;
    context.fill();
  }
  function drawX(r, c, fillStyle) {
    context.beginPath();
    var t = 4/30;
    var points = [
      [t, 0], [0.5, 0.5-t], [1-t, 0], [1, t], [0.5+t, 0.5], [1, 1-t],
      [1-t, 1], [0.5, 0.5+t], [t, 1], [0, 1-t], [0.5-t, 0.5], [0, t], [t, 0]
    ];
    drawPoly(r, c, points);
    context.fillStyle = fillStyle;
    context.fill();
  }

  function drawGridPattern() {
    var patternCanvas = document.createElement("canvas");
    patternCanvas.width = tileSize;
    patternCanvas.height = tileSize;
    var patternContext = patternCanvas.getContext("2d");
    patternContext.strokeStyle = "#fff";
    patternContext.beginPath();
    patternContext.moveTo(0, 0);
    patternContext.lineTo(0, tileSize);
    patternContext.lineTo(tileSize, tileSize);
    patternContext.lineTo(tileSize, 0);
    patternContext.lineTo(0, 0);
    patternContext.stroke();
    return context.createPattern(patternCanvas, 'repeat');
  }
  function drawGrid() {
    if (gridPattern === undefined) gridPattern = drawGridPattern();
    context.save();
    context.globalAlpha = 0.4;
    context.fillStyle = gridPattern;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.restore();
  }
}

function findAnimation(animationTypes, objectId) {
  if (animationQueueCursor === animationQueue.length) return null;
  var currentAnimation = animationQueue[animationQueueCursor];
  for (var i = 1; i < currentAnimation.length; i++) {
    var animation = currentAnimation[i];
    if (animationTypes.indexOf(animation[0]) !== -1 &&
        animation[1] === objectId) {
      return animation;
    }
  }
}
function findAnimationDisplacementRowcol(objectType, objectId) {
  var dr = 0;
  var dc = 0;
  var animationTypes = [
    "m" + objectType, // MOVE_SNAKE | MOVE_BLOCK
    "t" + objectType, // TELEPORT_SNAKE | TELEPORT_BLOCK
  ];
  // skip the current one
  for (var i = animationQueueCursor + 1; i < animationQueue.length; i++) {
    var animations = animationQueue[i];
    for (var j = 1; j < animations.length; j++) {
      var animation = animations[j];
      if (animationTypes.indexOf(animation[0]) !== -1 &&
          animation[1] === objectId) {
        dr += animation[2];
        dc += animation[3];
      }
    }
  }
  var movementAnimation = findAnimation(animationTypes, objectId);
  if (movementAnimation != null) {
    dr += movementAnimation[2] * (1 - animationProgress);
    dc += movementAnimation[3] * (1 - animationProgress);
  }
  return {r: -dr, c: -dc};
}
function hasFutureRemoveAnimation(object) {
  var animationTypes = [
    EXIT_SNAKE,
    DIE_BLOCK,
  ];
  for (var i = animationQueueCursor; i < animationQueue.length; i++) {
    var animations = animationQueue[i];
    for (var j = 1; j < animations.length; j++) {
      var animation = animations[j];
      if (animationTypes.indexOf(animation[0]) !== -1 &&
          animation[1] === object.id) {
        return true;
      }
    }
  }
}

function previewPaste(hoverR, hoverC) {
  var offsetR = hoverR - clipboardOffsetRowcol.r;
  var offsetC = hoverC - clipboardOffsetRowcol.c;

  var newLevel = JSON.parse(JSON.stringify(level));
  var selectedLocations = [];
  var selectedObjects = [];
  clipboardData.selectedLocations.forEach(function(location) {
    var tileCode = clipboardData.level.map[location];
    var rowcol = getRowcol(clipboardData.level, location);
    var r = rowcol.r + offsetR;
    var c = rowcol.c + offsetC;
    if (!isInBounds(newLevel, r, c)) return;
    var newLocation = getLocation(newLevel, r, c);
    newLevel.map[newLocation] = tileCode;
    selectedLocations.push(newLocation);
  });
  clipboardData.selectedObjects.forEach(function(object) {
    var newLocations = [];
    for (var i = 0; i < object.locations.length; i++) {
      var rowcol = getRowcol(clipboardData.level, object.locations[i]);
      rowcol.r += offsetR;
      rowcol.c += offsetC;
      if (!isInBounds(newLevel, rowcol.r, rowcol.c)) {
        // this location is oob
        if (object.type === SNAKE) {
          // snakes must be completely in bounds
          return;
        }
        // just skip it
        continue;
      }
      var newLocation = getLocation(newLevel, rowcol.r, rowcol.c);
      newLocations.push(newLocation);
    }
    if (newLocations.length === 0) return; // can't have a non-present object
    var newObject = JSON.parse(JSON.stringify(object));
    newObject.locations = newLocations;
    selectedObjects.push(newObject);
  });
  return {
    level: newLevel,
    selectedLocations: selectedLocations,
    selectedObjects: selectedObjects,
  };
}

function getNaiveOrthogonalPath(a, b) {
  // does not include a, but does include b.
  var rowcolA = getRowcol(level, a);
  var rowcolB = getRowcol(level, b);
  var path = [];
  if (rowcolA.r < rowcolB.r) {
    for (var r = rowcolA.r; r < rowcolB.r; r++) {
      path.push(getLocation(level, r + 1, rowcolA.c));
    }
  } else {
    for (var r = rowcolA.r; r > rowcolB.r; r--) {
      path.push(getLocation(level, r - 1, rowcolA.c));
    }
  }
  if (rowcolA.c < rowcolB.c) {
    for (var c = rowcolA.c; c < rowcolB.c; c++) {
      path.push(getLocation(level, rowcolB.r, c + 1));
    }
  } else {
    for (var c = rowcolA.c; c > rowcolB.c; c--) {
      path.push(getLocation(level, rowcolB.r, c - 1));
    }
  }
  return path;
}
function identityFunction(x) {
  return x;
}
function compareId(a, b) {
  return operatorCompare(a.id, b.id);
}
function operatorCompare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}
function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}
function copyArray(array) {
  return array.map(identityFunction);
}
function getSetIntersection(array1, array2) {
  if (array1.length * array2.length === 0) return [];
  return array1.filter(function(x) { return array2.indexOf(x) !== -1; });
}
function getSetSubtract(array1, array2) {
  if (array1.length === 0) return [];
  return array1.filter(function(x) { return array2.indexOf(x) === -1; });
}
function makeScaleCoordinatesFunction(width1, width2, offset) {
  return function(location) {
    return location + (width2 - width1) * Math.floor(location / width1) + offset;
  };
}

var expectHash;
window.addEventListener("hashchange", function() {
  if (location.hash === expectHash) {
    // We're in the middle of saveLevel() or saveReplay().
    // Don't react to that event.
    expectHash = null;
    return;
  }
  // The user typed into the url bar or used Back/Forward browser buttons, etc.
  loadFromLocationHash();
});
function loadFromLocationHash() {
  var hashSegments = location.hash.split("#");
  hashSegments.shift(); // first element is always ""
  if (!(1 <= hashSegments.length && hashSegments.length <= 2)) return false;
  var hashPairs = hashSegments.map(function(segment) {
    var equalsIndex = segment.indexOf("=");
    if (equalsIndex === -1) return ["", segment]; // bad
    return [segment.substring(0, equalsIndex), segment.substring(equalsIndex + 1)];
  });

  if (hashPairs[0][0] !== "level") return false;
  try {
    var level = parseLevel(hashPairs[0][1]);
  } catch (e) {
    alert(e);
    return false;
  }
  loadLevel(level);
  if (hashPairs.length > 1) {
    try {
      if (hashPairs[1][0] !== "replay") throw new Error("unexpected hash pair: " + hashPairs[1][0]);
      parseAndLoadReplay(hashPairs[1][1]);
    } catch (e) {
      alert(e);
      return false;
    }
  }
  return true;
}

// run test suite
var testTime = performance.now();
if (compressSerialization(stringifyLevel(parseLevel(testLevel_v0))) !== testLevel_v0_converted) throw new Error("v0 level conversion is broken");
// ask the debug console for this variable if you're concerned with how much time this wastes.
testTime = performance.now() - testTime;

loadPersistentState();
if (!loadFromLocationHash()) {
  loadLevel(parseLevel(exampleLevel));
}

function updateViewportMirror(viewport) {
  visualViewportMirror.style.left = viewport.offsetLeft + "px";
  visualViewportMirror.style.top = viewport.offsetTop + "px";
  visualViewportMirror.style.width = viewport.width + "px";
  visualViewportMirror.style.height = viewport.height + "px";
  visualViewportMirror.style.fontSize = viewport.height * 0.03 + "px";
}
// using visual viewport api to get zoomed mobile screen area
let pendingUpdate = false;
function viewportHandler(event) {
  if (pendingUpdate) return;
  pendingUpdate = true;

  requestAnimationFrame(() => {
    pendingUpdate = false;
    updateViewportMirror(event.target);
  });
}

window.visualViewport.addEventListener("scroll", viewportHandler);
window.visualViewport.addEventListener("resize", viewportHandler);
updateViewportMirror(window.visualViewport);

// toggle touch controls
document.getElementById("touchControlsButton").addEventListener("click", function() {
  var controls = document.getElementById("touchControls");
  if (controls.style.visibility === "visible") {
    controls.style.visibility = "hidden";
  } else {
    controls.style.visibility = "visible";
    setPaintBrushTileCode(null);
  }
});
// handle touch controls
document.getElementById("touchHideButton").addEventListener("click", function() {
  document.getElementById("touchControls").style.visibility = "hidden";
});
document.getElementById("touchRestartButton").addEventListener("click", function() {
  if (unmoveStuff.undoStack.length === 0 && unmoveStuff.redoStack.length > 0) {
    unreset(unmoveStuff);
  } else {
    reset(unmoveStuff);
  }
  render();
});
// unmove and remove are holdable
var holdTimeout = 0;
var holdInterval = 0;
document.getElementById("touchUnmoveButton").addEventListener("pointerdown", function(event) {
  if (!event.isPrimary) return;
  undo(unmoveStuff);
  render();
  holdTimeout = setTimeout(function() {
    undo(unmoveStuff);
    render();
    holdInterval = setInterval(function() {
      undo(unmoveStuff);
      render();
    }, 50)
  }, 500);
});
document.getElementById("touchUnmoveButton").addEventListener("pointerup", function() {
  clearTimeout(holdTimeout);
  clearInterval(holdInterval);
});
document.getElementById("touchUnmoveButton").addEventListener("pointercancel", function() {
  clearTimeout(holdTimeout);
  clearInterval(holdInterval);
});
document.getElementById("touchRemoveButton").addEventListener("pointerdown", function(event) {
  if (!event.isPrimary) return;
  redo(unmoveStuff);
  render();
  holdTimeout = setTimeout(function() {
    redo(unmoveStuff);
    render();
    holdInterval = setInterval(function() {
      redo(unmoveStuff);
      render();
    }, 50)
  }, 500);
});
document.getElementById("touchRemoveButton").addEventListener("pointerup", function() {
  clearTimeout(holdTimeout);
  clearInterval(holdInterval);
});
document.getElementById("touchRemoveButton").addEventListener("pointercancel", function() {
  clearTimeout(holdTimeout);
  clearInterval(holdInterval);
});
document.getElementById("touchUpButton").addEventListener("pointerdown", function() {
  move(-1, 0);
  render();
});
document.getElementById("touchLeftButton").addEventListener("pointerdown", function() {
  move(0, -1);
  render();
});
document.getElementById("touchSwitchButton").addEventListener("pointerdown", function() {
  switchSnakes(1);
  render();
});
document.getElementById("touchRightButton").addEventListener("pointerdown", function() {
  move(0, 1);
  render();
});
document.getElementById("touchDownButton").addEventListener("pointerdown", function() {
  move(1, 0);
  render();
});
document.getElementById("touchGridButton").addEventListener("click", function() {
  toggleGrid();
});
document.getElementById("touchSaveButton").addEventListener("click", function() {
  saveReplay();
});