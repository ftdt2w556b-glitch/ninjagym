-- ============================================================
-- Migration 009: Work Guide — Behind The Counter (BTC) content
-- Source: BTC Rick Tew's NinjaGym.pdf + BTC Reminder Lists.pdf
-- Run in Supabase SQL Editor
-- ============================================================

UPDATE work_instructions SET instructions = $$
• Make coffee using drip methods (e.g., V60).
• Prepare and serve frozen shakes and flavored beverages.

DAILY REMINDER CHECKLIST:
• Make Coffee
• Make Shake
• Dishes / Cups
$$ WHERE topic_name = 'BTC – Prepare Beverages';


UPDATE work_instructions SET instructions = $$
• Warm up snack items.
• Upsell food items and beverages to customers.

DAILY REMINDER CHECKLIST:
• Air Fry Bake
• Prep Orders
• Display
• Wash Hands
• Hygiene
$$ WHERE topic_name = 'BTC – Food Preparation';


UPDATE work_instructions SET instructions = $$
• Explain various programs (20-minute vs 50, guided vs unguided, belts, etc.).
• Take cash payments and provide change.
• Assist students and parents with inquiries.
• Extra attention on mini-ninja attendees.

DAILY REMINDER CHECKLIST:
• Hi + Bye
• Explaining Prices +
• Register / Card Use
• Cash Box
• Upsells
• 360 Watch
• 360 Checks
• Clean Entry
• No Threats
• Notify Staff
• Safety First
• Wall Touch
• Salute
• Intro Prep
• Break Time
$$ WHERE topic_name = 'BTC – Customer Interaction';


UPDATE work_instructions SET instructions = $$
• Market the training center on Facebook (NinjaGym), uploading clips from the collection.
• Create Canva Shorts for YouTube.
• Capture and upload photo or video clips of sessions and updates to the PC desktop.
• Prepare photos for the photo wall.

DAILY REMINDER CHECKLIST:
• New Media
• Post FB
• Post Samui
• Post X + IG
• Event Post
• NinjaGym (page/profile check)
• Canva Prep
• Tactic Clips
• Add to USB
• Data Prep
$$ WHERE topic_name = 'BTC – Marketing';


UPDATE work_instructions SET instructions = $$
• Upsell merchandise such as t-shirts, uniforms, and belt programs (limited offers).

DAILY REMINDER CHECKLIST:
• Upsells
• Explaining Prices +
• Register
• Card Use
• Cash Box
$$ WHERE topic_name = 'BTC – Sales';


UPDATE work_instructions SET instructions = $$
• Write down student attendance.
• Record staff arrival and departure times.
• Track if staff guided students through the 3 Zones, noting which child and who assisted.
• Correct and apply details to Google Sheets.

DAILY REMINDER CHECKLIST:
• Data Prep
• Check Stock
• Google Sheets entry
• Force 5 (track 5 key daily tasks)
$$ WHERE topic_name = 'BTC – Administrative Tasks';


UPDATE work_instructions SET instructions = $$
• Clean the café area regularly.
• Wash hands frequently.
• Maintain cleanliness and prepare food displays.
• Collect and dispose of trash daily.
• Ensure the overall cleanliness of the training center.

DAILY REMINDER CHECKLIST:
• Super Clean
• Organize
• Wash Hands
• Hygiene
• Display
• Dishes / Cups
• Bye Bye (leave area clean)
$$ WHERE topic_name = 'BTC – Facility Maintenance';


UPDATE work_instructions SET instructions = $$
• Teach assistants the BTC duties on this sheet.
• Explain necessary tasks and responsibilities to staff.

DAILY REMINDER CHECKLIST:
• Notify Staff
• Safety First
• Break Time
• Force 5 (ensure team covers the 5 key areas)
$$ WHERE topic_name = 'BTC – Staff Coordination';


UPDATE work_instructions SET instructions = $$
• Monitor and restock coffee supplies, snacks, and other consumables.
• Keep track of uniform and merchandise inventory.

DAILY REMINDER CHECKLIST:
• Check Stock
• Prep Orders
• Data Prep (log stock levels in Google Sheets)
$$ WHERE topic_name = 'BTC – Inventory Management';


UPDATE work_instructions SET instructions = $$
• Gather feedback from students and parents to improve services.
• Implement suggested improvements where feasible.

DAILY REMINDER CHECKLIST:
• Hi + Bye (every interaction is a chance to collect feedback)
• 360 Watch (observe the floor and student experience)
• Notify Staff of any recurring issues
$$ WHERE topic_name = 'BTC – Customer Feedback';


UPDATE work_instructions SET instructions = $$
• Assist in organizing and promoting special events or themed sessions.
• Coordinate with external vendors or partners if necessary.

DAILY REMINDER CHECKLIST:
• Event Post (promote on social media)
• Post Samui (local community pages)
• Intro Prep (prepare for any walk-in or event guests)
• Notify Staff of upcoming events
$$ WHERE topic_name = 'BTC – Event Coordination';


UPDATE work_instructions SET instructions = $$
• Be familiar with and able to execute emergency protocols.
• Ensure the safety and well-being of all students and staff during emergencies.

KEY RULES:
• No Threats — maintain a safe, calm environment at all times.
• Safety First — always prioritize safety over any other task.
• 360 Watch — continuously scan the room and floor for hazards or incidents.
• Notify Staff immediately of any emergency situation.
• Never leave the floor unsupervised during an active class or open play session.
$$ WHERE topic_name = 'BTC – Emergency Procedures';


UPDATE work_instructions SET instructions = $$
• Address any issues or conflicts that arise with students or parents.
• Escalate serious matters to the appropriate management staff.

GUIDELINES:
• Stay calm and professional at all times.
• Listen fully before responding.
• Never argue — acknowledge and redirect.
• Escalate to admin/owner for any unresolved issues or complaints.
• No Threats — zero tolerance for threatening behaviour from anyone.
$$ WHERE topic_name = 'BTC – Conflict Resolution';


UPDATE work_instructions SET instructions = $$
• Assist in scheduling sessions and maintaining the training center's calendar.
• Notify staff and students of any schedule changes.

DAILY REMINDER CHECKLIST:
• Check schedule at start of shift.
• Notify Staff of any changes or special bookings.
• Record any session adjustments in Google Sheets.
• Intro Prep — prepare for all scheduled sessions before they begin.
$$ WHERE topic_name = 'BTC – Scheduling';


UPDATE work_instructions SET instructions = $$
All BTC staff must learn and be competent in the following:

• Google Sheets — Learn data entry and management.
• Canva Pro — Create marketing materials and shorts.
• Drip Coffee — Master V60 coffee preparation.
• Facebook Groups — Manage and market through FB groups.
• Food Prep Techniques — Learn proper food preparation and hygiene.
• Cleanliness — Maintain high cleanliness standards at all times.
• Shakes and Flavors — Prepare a variety of frozen shakes.
$$ WHERE topic_name = 'BTC – Minimum Training Requirements';


UPDATE work_instructions SET instructions = $$
EQUIPMENT AT THE COUNTER:
• Quality high chair or comfy bar stool
• Drip coffee equipment (water, V60, filters)
• Shake blender
• Computer for managing Google Sheets and other tasks
• Air fryer / food warmer for snack preparation
• Cash box and card reader
• Display materials for photo wall and product display

DAILY SETUP CHECKLIST:
• Organize — ensure all equipment is in place and ready.
• Check Stock — verify supplies are stocked before opening.
• Display — arrange food and merchandise displays neatly.
$$ WHERE topic_name = 'BTC – Tools And Equipment';
