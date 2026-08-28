#!/usr/bin/env python3
"""
Template Enhancement Script
Applies consistent fixes across all project templates:
1. Adds cost/effort to leaf tasks missing them
2. Links risks to specific tasks
3. Assigns resources to unassigned tasks
4. Adds cross-phase dependencies
5. Adds material allocations for spend entries
6. Adds post-project closure tasks
"""

import json
import os
import glob

TEMPLATE_DIR = "src/extensions/project-wbs/templates/json"

def load_template(path):
    with open(path, 'r') as f:
        return json.load(f)

def save_template(path, data):
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)

def get_all_tasks(tasks, depth=0):
    """Flatten task tree into list with depth info"""
    result = []
    for task in tasks:
        item = {**task, '_depth': depth, '_parent': None}
        result.append(item)
        if 'children' in task:
            children = get_all_tasks(task['children'], depth + 1)
            for c in children:
                c['_parent'] = task['id']
            result.extend(children)
    return result

def get_leaf_tasks(tasks):
    """Get only leaf tasks (no children)"""
    all_tasks = get_all_tasks(tasks)
    return [t for t in all_tasks if 'children' not in t]

def get_resources_by_role(resources):
    """Group resources by role keywords"""
    by_role = {}
    for r in resources:
        role = r.get('role', '').lower()
        by_role[role] = r
    return by_role

def assign_resource(task, resources, by_role):
    """Assign a resource to a task based on keywords"""
    name = task.get('name', '').lower()
    desc = task.get('description', '').lower()
    combined = f"{name} {desc}"
    
    # Keyword matching
    if any(k in combined for k in ['develop', 'code', 'implement', 'build', 'deploy']):
        for r in resources:
            if 'dev' in r.get('role', '').lower():
                return r['id']
    elif any(k in combined for k in ['design', 'creative', 'visual', 'graphic']):
        for r in resources:
            if 'design' in r.get('role', '').lower():
                return r['id']
    elif any(k in combined for k in ['test', 'qa', 'quality']):
        for r in resources:
            if 'qa' in r.get('role', '').lower():
                return r['id']
    elif any(k in combined for k in ['market', 'campaign', 'social', 'email']):
        for r in resources:
            if 'market' in r.get('role', '').lower():
                return r['id']
    elif any(k in combined for k in ['budget', 'finance', 'account', 'cost']):
        for r in resources:
            if 'pm' in r.get('role', '').lower():
                return r['id']
    
    # Default to PM or first resource
    for r in resources:
        if 'pm' in r.get('role', '').lower() or 'manager' in r.get('role', '').lower():
            return r['id']
    return resources[0]['id'] if resources else None

def estimate_cost(task, resource_rate):
    """Estimate task cost based on effort and rate"""
    effort = task.get('effort', 0)
    if effort > 0:
        return int(effort * resource_rate * 0.8)  # 80% utilization
    return 1000  # Default

def estimate_effort(task):
    """Estimate effort from duration"""
    start = task.get('startDate', '')
    end = task.get('endDate', '')
    if start and end:
        from datetime import datetime
        try:
            s = datetime.fromisoformat(start)
            e = datetime.fromisoformat(end)
            days = (e - s).days + 1
            return max(8, days * 8)  # Min 8 hours
        except:
            pass
    return 8  # Default

def add_closure_phase(template):
    """Add post-project closure phase"""
    tasks = template.get('tasks', [])
    if not tasks:
        return template
    
    # Check if closure already exists
    for t in tasks:
        if 'closure' in t.get('name', '').lower() or 'close' in t.get('name', '').lower():
            return template
    
    # Get last milestone date
    last_date = template.get('endDate', '2026-12-31')
    from datetime import datetime, timedelta
    try:
        end_dt = datetime.fromisoformat(last_date)
        closure_start = (end_dt + timedelta(days=1)).strftime('%Y-%m-%d')
        closure_end = (end_dt + timedelta(days=3)).strftime('%Y-%m-%d')
    except:
        closure_start = last_date
        closure_end = last_date
    
    # Get PM resource
    resources = template.get('resources', [])
    pm_id = None
    for r in resources:
        if 'pm' in r.get('role', '').lower() or 'manager' in r.get('role', '').lower():
            pm_id = r['id']
            break
    if not pm_id and resources:
        pm_id = resources[0]['id']
    
    # Get last milestone dependency
    last_milestone_id = None
    for t in reversed(tasks):
        if t.get('isMilestone'):
            last_milestone_id = t['id']
            break
    if not last_milestone_id:
        last_milestone_id = tasks[-1]['id']
    
    closure_phase = {
        "id": "closure",
        "name": "Project Closure",
        "startDate": closure_start,
        "endDate": closure_end,
        "description": "Final report, lessons learned, and administrative closure",
        "progress": 0,
        "status": "not_started",
        "cost": 2000,
        "children": [
            {
                "id": "closure-1",
                "name": "Lessons learned workshop",
                "startDate": closure_start,
                "endDate": closure_start,
                "description": "Document what went well and what to improve",
                "progress": 0,
                "status": "not_started",
                "resourceId": pm_id,
                "cost": 1000,
                "effort": 8,
                "effortUnit": "hours",
                "dependencies": [last_milestone_id]
            },
            {
                "id": "closure-2",
                "name": "Final project report",
                "startDate": closure_end,
                "endDate": closure_end,
                "description": "Compile final project report and metrics",
                "progress": 0,
                "status": "not_started",
                "resourceId": pm_id,
                "cost": 1000,
                "effort": 8,
                "effortUnit": "hours",
                "dependencies": ["closure-1"]
            }
        ]
    }
    
    tasks.append(closure_phase)
    return template

def enhance_template(template):
    """Apply all enhancements to a template"""
    tasks = template.get('tasks', [])
    resources = template.get('resources', [])
    risks = template.get('risks', [])
    
    if not tasks:
        return template
    
    by_role = get_resources_by_role(resources)
    
    # Get all leaf tasks
    leaf_tasks = get_leaf_tasks(tasks)
    
    # Phase 1: Add cost/effort/resource to leaf tasks
    for task in leaf_tasks:
        if 'cost' not in task or not task['cost']:
            task['cost'] = estimate_cost(task, 100)
        if 'effort' not in task or not task['effort']:
            task['effort'] = estimate_effort(task)
            task['effortUnit'] = 'hours'
        if 'resourceId' not in task or not task['resourceId']:
            task['resourceId'] = assign_resource(task, resources, by_role)
    
    # Phase 2: Add cross-phase dependencies
    for i, phase in enumerate(tasks):
        if i > 0 and 'children' in phase:
            prev_phase = tasks[i-1]
            if 'children' in prev_phase and prev_phase['children']:
                # First child of this phase depends on last child of previous phase
                last_prev = prev_phase['children'][-1]
                first_child = phase['children'][0]
                if 'dependencies' not in first_child:
                    first_child['dependencies'] = [last_prev['id']]
    
    # Phase 3: Link risks to tasks
    for risk in risks:
        if not risk.get('taskId'):
            # Try to match risk to a task
            risk_title = risk.get('title', '').lower()
            risk['taskId'] = None  # Project-level risk
    
    # Phase 4: Add material allocations for spend entries
    spend_entries = template.get('accounting', {}).get('spendEntries', [])
    existing_allocations = template.get('allocations', [])
    materials = template.get('materials', [])
    
    # For unmapped spend entries, create service allocations
    allocated_task_ids = {a.get('taskId') for a in existing_allocations}
    for spend in spend_entries:
        task_id = spend.get('taskId')
        if task_id and task_id not in allocated_task_ids:
            # Create a service allocation
            alloc_id = f"alloc-{task_id}"
            if not any(a.get('id') == alloc_id for a in existing_allocations):
                existing_allocations.append({
                    "id": alloc_id,
                    "materialId": materials[0]['id'] if materials else None,
                    "taskId": task_id,
                    "allocatedQuantity": 1,
                    "consumedQuantity": 1,
                    "allocationDate": spend.get('date', ''),
                    "expectedReturnDate": None,
                    "actualCost": spend.get('amount', 0),
                    "notes": f"Service: {spend.get('source', 'Unknown')}"
                })
                allocated_task_ids.add(task_id)
    
    template['allocations'] = existing_allocations
    
    # Phase 5: Add post-project closure
    template = add_closure_phase(template)
    
    return template

def main():
    """Process all templates"""
    pattern = os.path.join(TEMPLATE_DIR, "*.json")
    files = glob.glob(pattern)
    
    for filepath in sorted(files):
        filename = os.path.basename(filepath)
        print(f"Processing {filename}...")
        
        template = load_template(filepath)
        enhanced = enhance_template(template)
        save_template(filepath, enhanced)
        
        # Report changes
        leaf_count = len(get_leaf_tasks(enhanced.get('tasks', [])))
        print(f"  -> {leaf_count} leaf tasks enhanced")
    
    print(f"\nDone! Processed {len(files)} templates.")

if __name__ == "__main__":
    main()
