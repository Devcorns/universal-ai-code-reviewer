# Sample Python file with intentional issues for testing the Code Reviewer

import os
from datetime import *  # Wildcard import

API_KEY = "sk-abc123def456ghi789jkl012mno345pqr678"  # Hardcoded secret

# Mutable default argument
def process_items(items, results=[]):
    for item in items:
        results.append(item)
    return results

# Bare except
def load_config(path):
    try:
        f = open(path, 'r')  # File opened without 'with'
        data = f.read()
        return data
    except:
        pass

# SQL injection
def get_user(user_id):
    query = "SELECT * FROM users WHERE id = " + str(user_id)
    return execute(query)

# Command injection
def run_report(name):
    os.system("generate_report " + name)

# Function too long and complex
def analyze_data(data, config, filters, threshold, options, debug_mode):
    results = []
    if data:
        if config:
            if filters:
                for item in data:
                    if item.get('type') == filters.get('type'):
                        if item.get('value') > threshold:
                            if options.get('include_metadata'):
                                if debug_mode:
                                    print(f"Processing: {item}")
                                results.append({
                                    'id': item['id'],
                                    'value': item['value'],
                                    'type': item['type'],
                                    'processed': True
                                })
                            else:
                                results.append({
                                    'id': item['id'],
                                    'value': item['value']
                                })
    return results

# eval usage
def dynamic_compute(expression):
    return eval(expression)

# Single-letter variable names
def calc(a, b, c):
    d = a + b
    e = d * c
    return e

# Print statements
def debug_info(obj):
    print(obj)
    print("Debug mode active")
    return obj

# TODO: Refactor this function
# FIXME: Memory leak in production
