let scrollTimeout;
this.editor = editorManager.editor;
this.context = $0.appendChild(document.createElement("div"));
context.className = "ace_editor ace_layer";
context.style.position = "fixed";
context.style.top = "13";
context.style.height = "auto";
context.style.backgroundColor = "rgba(0,0,0,0.75)";

editor.session.on("changeScrollTop", (...args) => {
  clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => doScroll(...args), 100);
});

function doScroll(scrollTop) {
  var firstVisibleRow = editor.getFirstVisibleRow();
  updateStickyScrollForCurrentRow(firstVisibleRow);
}

var isFoldStructureIncrementing = false;
var previousFoldStructure = [];
function updateStickyScrollForCurrentRow(row) {
  var session = editor.session;
  var foldWidgets = session.foldWidgets;
  var foldStructure = [];

  var length = previousFoldStructure.length;

  var startRow = row + length;
  var endRow = row + length + (isFoldStructureIncrementing ? 0 : 1);

  for (var i = 0; i <= startRow; i += 1) {
    if (foldWidgets[i] == "") continue;

    var range = session.getFoldWidgetRange(i);
    if (!range) continue;

    var start = range.start.row;
    var end = range.end.row;

    if (startRow >= start && endRow < end) {
      //renderLine(i);
      foldStructure.push(renderLine(i).outerHTML);
    }
  }

  context.innerHTML = foldStructure.join("");

  let newLength = foldStructure.length;
  if (newLength < length) {
    isFoldStructureIncrementing = false;
  } else if (newLength > length) {
    isFoldStructureIncrementing = true;
  }

  previousFoldStructure = foldStructure;
}

function renderLine(row) {
  var textLayer = editor.renderer.$textLayer;
  var height = document.querySelector(".ace_line_group").style.height;

  var lineDiv = document.createElement("div");
  lineDiv.classList.add("ace_line");
  lineDiv.style.height = height + "px";

  var tokens = editor.session.getTokens(row);

  textLayer.$renderSimpleLine(lineDiv, tokens);
  return lineDiv;
}
