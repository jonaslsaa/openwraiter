var enabled = false;
var apiKey = '';
var modelName = '';
var modelCodename = '';

// get sync data
chrome.storage.sync.get(['enabled', 'apiKey', 'model-name', 'model-value']).then(function(result) {
    enabled = result.enabled;
    apiKey = result.apiKey;
    modelName = result['model-name'].trim();
    modelCodename = result['model-value'].trim();
    if(enabled && apiKey) {
        console.log("Openwraiter autocomplete should be enabled, using model:", modelName);
        if(!(modelName && modelCodename)) {
            console.log("Model name or codename not set.");
        }
    } else {
        console.log("Openwraiter autocomplete is missing API key or is disabled.");
        console.log(apiKey);
        console.log(enabled);
    }

    $(document).ready(function() {
        setTimeout(function() {
            initAutoComplete();
        }, 1000);
    });
});

// listener for storage changes
chrome.storage.onChanged.addListener(function(changes, namespace) {
    for (key in changes) {
        if (key == 'enabled') {
            enabled = changes[key].newValue;
            console.log("Openwraiter autocomplete is now", enabled ? "enabled" : "disabled");
        } else if (key == 'apiKey') {
            apiKey = changes[key].newValue;
            console.log("Openwraiter autocomplete API key is now", apiKey);
        } else if (key == 'model-name') {
            modelName = changes[key].newValue;
        } else if (key == 'model-value') {
            modelCodename = changes[key].newValue;
            console.log("Openwraiter autocomplete model codename is now", modelCodename);
        }
    }
});

const waitForUserTyping = 600; // ms
var currentlyShowingSuggestion = false;
var currentCursorPosition = 0;
var currentAutoComplete = "";


function incrementCallsToday() {
    let calls = 0;
    chrome.storage.local.get(['calls-today']).then(function(result) {
        let callsToday = result['calls-today'];
        if (callsToday) {
            calls = parseInt(callsToday);
        }
        calls++;
        chrome.storage.local.set({'calls-today': calls});
    });
}

function doAPICompletion(context_text){
    let endpoint = "https://api.openai.com/v1/engines/" + modelCodename + "/completions";
    incrementCallsToday();
    return $.ajax({
        url: endpoint,
        type: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey
        },
        data: JSON.stringify({
            prompt: context_text,
            temperature: 0.2, // this might need to be adjusted
            max_tokens: 64 // this might need to be adjusted
        }),
        success: function(data) {
            return data.choices[0].text;
        },
        error: function(data) {
            console.log("Error: " + data.responseText);
            return "";
        }
    });
}

$.fn.selectRange = function(start, end) {
    if(end === undefined) {
        end = start;
    }
    return this.each(function() {
        if('selectionStart' in this) {
            this.selectionStart = start;
            this.selectionEnd = end;
        } else if(this.setSelectionRange) {
            this.setSelectionRange(start, end);
        } else if(this.createTextRange) {
            var range = this.createTextRange();
            range.collapse(true);
            range.moveEnd('character', end);
            range.moveStart('character', start);
            range.select();
        }
    });
};

$.fn.getCursorPosition = function() {
    var el = $(this).get(0);
    var pos = 0;
    if('selectionStart' in el) {
        pos = el.selectionStart;
    } else if('selection' in document) {
        el.focus();
        var Sel = document.selection.createRange();
        var SelLength = document.selection.createRange().text.length;
        Sel.moveStart('character', -el.value.length);
        pos = Sel.text.length - SelLength;
    }
    return pos;
}

cache = new Map();
function getAutocomplete(context_text) {
    if(!enabled || !apiKey) {
        return "";
    }
    return new Promise(function(resolve, reject) {
        // check cache first
        if (cache.has(context_text)) {
            console.log("cache hit");
            resolve(cache.get(context_text));
        } else {
            // if not in cache, get from api
            doAPICompletion(context_text).then(function(data) {
                cache.set(context_text, data);
                console.log("Found for(" + context_text + "):", data);
                resolve(data);
            });
        }
    });
}

function fake_getAutocomplete(context_text) {
    console.log("Fake autocomplete:", context_text);
    return new Promise(function(resolve, reject) {
        let obj = { 'choices': ['test'] };
        resolve(obj);
    });
}

function initAutoComplete() {

    // find all text input and text areas with jquery
    var textInputs = [];
    textInputs.push(...$('input[type=text], textarea'));
    //TODO: consider, get all contenteditables, but: https://stackoverflow.com/questions/45632580/keyup-event-on-contenteditable-div 
    var typingTimeout;

    // on keyup, wait N ms and get autocomplete
    for (let textInput of textInputs) { 
        // on unfocus, clear timeout
        textInput.onblur = function() {
            clearTimeout(typingTimeout);
        }

        textInput.addEventListener('keyup', function(e) {
            if(typingTimeout) { // if user types too fast, clear timeout
                currentlyShowingSuggestion = false;
                clearTimeout(typingTimeout);
            }

            // keyCode must be enter, space
            if (!(e.keyCode == 13 || e.keyCode == 32)) {
                clearTimeout(typingTimeout);
                currentlyShowingSuggestion = false;
                return;
            }
            
            // get text input which triggered event
            let thisTextInput = $(this);
            // get text input value
            let textInputValue = thisTextInput.val();
            // wait 500 ms for new keystrokes, if not get autocomplete
            typingTimeout = setTimeout(function() {
                // if text input value is empty, return
                if (textInputValue == '') {
                    return;
                }
                let currentPosition = thisTextInput.getCursorPosition();
                let context_text = document.title + "\n" + textInputValue.substring(0, currentPosition);
                // get autocomplete
                getAutocomplete(context_text).then(function(data) {
                    // get first autocomplete
                    let firstAutocomplete = data.choices[0].text;
                    currentCursorPosition = currentPosition;

                    // insert autocomplete at current position
                    thisTextInput.val(textInputValue.substring(0, currentPosition) + firstAutocomplete + textInputValue.substring(currentPosition));
                    currentAutoComplete = firstAutocomplete;
                    currentlyShowingSuggestion = true;
                    
                    // set cursor to before autocomplete
                    thisTextInput.selectRange(currentPosition, currentPosition + firstAutocomplete.length);
                    clearTimeout(typingTimeout);
                });
            }, waitForUserTyping);
        });
        textInput.addEventListener('keydown', function(e) {
            if(currentlyShowingSuggestion == false || currentAutoComplete == "") {
                clearTimeout(typingTimeout);
                return;
            }
            // override tab to do same as right arrow key for autocomplete
            if (e.keyCode == 9 && e.shiftKey == false) {
                e.preventDefault();
                let thisTextInput = $(this);
                thisTextInput.selectRange(currentCursorPosition + currentAutoComplete.length);
            }
        });
    }
}