var statusButton = $('#status-button');
var apiKeyInput = $('#api-key');
var callsTodayText = $('.status-text-value'); 
// get all <a> with id model-select
var dropdownModelSelects = $('a[id^="model-select"]');

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


// listener for storage changes
chrome.storage.onChanged.addListener(function(changes, namespace) {
    for (key in changes) {
        if (key == 'calls-today') {
            let newCalls = changes[key].newValue;
            callsTodayText.text(newCalls);
        }
    }
});


function setUIStatus(enabled) {
  if (enabled) {
    statusButton.text('Enabled');
    statusButton.removeClass('btn-danger');
    statusButton.addClass('btn-success');
  } else {
    statusButton.text('Disabled');
    statusButton.removeClass('btn-success');
    statusButton.addClass('btn-danger');
  }
}

function testOpenAIKey(apiKey) {
  $.ajax({
    url: 'https://api.openai.com/v1/engines/text-ada-001/completions', // engine defined here
    type: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
    },
    data: JSON.stringify({
        prompt: 'Say this is a test',
        temperature: 0,
        max_tokens: 6
    }),
    success: function(data) {
        console.log("Success!");
        console.log(data);
        chrome.storage.local.set({'enabled': true});
        setUIStatus(true);

        incrementCallsToday();
    },
    error: function(data) {
        console.log("Error: " + data.responseText);
        chrome.storage.local.set({'enabled': false});
        setUIStatus(false);
    }
    });
}

chrome.storage.local.get(['calls-today']).then(function(result) {
    let calls = 0;
    if (result['calls-today']) {
        calls = parseInt(result['calls-today']);
    }
    callsTodayText.text(calls);
});

chrome.storage.local.get(['model-name']).then(function(result) {
    let modelName = result['model-name'];
    if (modelName) {
        let modelCapitalized = modelName.charAt(0).toUpperCase() + modelName.slice(1);
        $('#model-name').text(modelCapitalized);
    }
});

// set api key if it is stored in local storage
chrome.storage.local.get(['apiKey', 'enabled']).then(function(result) {
    let gotApiKey = result.apiKey;
    let enabled = result.enabled;
    
    if(gotApiKey) {
        apiKeyInput.val(gotApiKey);
        if(enabled) {
            setUIStatus(true);
        }
    } else {
        chrome.storage.local.set({'enabled': false});
        setUIStatus(false);
    }
});



// if button is clicked, save api key to local storage if it is not empty
statusButton.click(function() {
    // TODO: add toggle for force enabled/disabled
    if(apiKeyInput.val() !== '') {
        let apiKey = apiKeyInput.val().trim();
        chrome.storage.local.set({'apiKey': apiKey});
        testOpenAIKey(apiKey);
    }
});

for (let dropdownModelSelect of dropdownModelSelects) {
    let thisItem = $(dropdownModelSelect); 
    // on click
    thisItem.click(function() {
        let modelName = thisItem.data('name');
        let modelValue = thisItem.data('value');
        let modelCapitalized = modelName.charAt(0).toUpperCase() + modelName.slice(1);
        $('#model-name').text(modelCapitalized);

        chrome.storage.local.set({'model-name': modelName});
        chrome.storage.local.set({'model-value': modelValue});
    });
}


// See pricing text
$('.small-info-text').click(function() {
    chrome.tabs.create({url: 'https://openai.com/api/pricing/'});
});