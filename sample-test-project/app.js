// Sample JavaScript file with intentional issues for testing the Code Reviewer

var userName = "admin"; // Should use const/let
var password = "SuperSecret123"; // Hardcoded credential

function processUserData(data) {
    // Loose equality
    if (data.role == "admin") {
        // eval usage
        eval("console.log('admin mode')");
    }

    // innerHTML assignment - XSS risk
    document.getElementById("output").innerHTML = data.name;

    // SQL injection risk
    var query = "SELECT * FROM users WHERE id = " + data.id;

    // console.log in production
    console.log("Processing:", data);

    // Empty catch block
    try {
        JSON.parse(data.raw);
    } catch (e) {
    }

    // Unused variable
    let tempValue = data.timestamp;

    return data;
}

// Function that is too long and complex
function analyzeReport(reports, filters, options, settings, metadata) {
    var result = [];
    if (reports) {
        if (filters) {
            if (options) {
                if (settings) {
                    for (var i = 0; i < reports.length; i++) {
                        for (var j = 0; j < filters.length; j++) {
                            for (var k = 0; k < options.length; k++) {
                                if (reports[i].type == filters[j]) {
                                    if (reports[i].status == options[k]) {
                                        if (reports[i].date > settings.startDate) {
                                            if (reports[i].date < settings.endDate) {
                                                result.push(reports[i]);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    return result;
}

// Missing await
async function fetchData(url) {
    const response = fetch(url);
    const data = response.json();
    return data;
}

// setInterval without clearInterval
function startPoller() {
    setInterval(() => {
        fetch("/api/status");
    }, 5000);
}

// Sequential awaits that could be parallel
async function loadDashboard() {
    const users = await fetch("/api/users");
    const orders = await fetch("/api/orders");
    const stats = await fetch("/api/stats");
    return { users, orders, stats };
}

// Dead code after return
function calculateTotal(items) {
    if (!items) return 0;
    return items.reduce((sum, item) => sum + item.price, 0);
    console.log("This will never execute");
    return -1;
}

// TODO: Fix this later
// FIXME: Race condition here

// Magic number
function isEligible(age) {
    return age >= 21 && age <= 65;
}

// debugger statement
function debug() {
    debugger;
    return true;
}
