// Sample TypeScript file with intentional issues for testing the Code Reviewer

interface User {
    id: number;
    name: string;
    email: string;
}

// Using 'any' type
function processData(input: any): any {
    // Type assertion without validation
    const user = input as User;

    // JSON.parse without try-catch
    const config = JSON.parse(input.configString);

    // parseInt without radix
    const count = parseInt(input.count);

    // Loose equality
    if (user.id == 0) {
        return null;
    }

    return { user, config, count };
}

// Empty catch block
async function loadUsers(): Promise<User[]> {
    try {
        const response = await fetch('/api/users');
        return await response.json();
    } catch (error) {
    }
    return [];
}

// Async function without error handling
async function saveUser(user: User): Promise<void> {
    const response = await fetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(user)
    });
    const result = await response.json();
    console.log('Saved:', result);
}

// Hardcoded API key
const API_ENDPOINT = "https://api.example.com";
const API_TOKEN = "ghp_abcdefghijklmnopqrstuvwxyz1234567890";

// dangerouslySetInnerHTML
function RenderHtml(props: { html: string }) {
    return { dangerouslySetInnerHTML: { __html: props.html } };
}

// var usage
var globalState = {};

// debugger
function troubleshoot() {
    debugger;
    return globalState;
}

// Sequential awaits
async function initDashboard() {
    const users = await fetch('/api/users').then(r => r.json());
    const settings = await fetch('/api/settings').then(r => r.json());
    return { users, settings };
}

// SSL verification disabled
const httpsOptions = {
    rejectUnauthorized: false,
    host: 'example.com'
};

// Switch without default
function getStatusLabel(code: number): string {
    switch (code) {
        case 200: return 'OK';
        case 404: return 'Not Found';
        case 500: return 'Server Error';
    }
    return 'Unknown';
}

// TODO: Add proper validation
// FIXME: This is a temporary workaround
