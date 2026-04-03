// ~1000 hardcoded questions covering every domain of life and business
// Format: { q, cat, p } — p: "high" | "medium" | "low"

export const SUGGESTIONS = [
  // ─── PERSONAL IDENTITY ───
  { q: "Full legal name — first, middle, last?", cat: "👤 Identity", p: "high" },
  { q: "ID number and date of issue?", cat: "👤 Identity", p: "high" },
  { q: "Passport number, country of issue, expiry date?", cat: "👤 Identity", p: "high" },
  { q: "Date and place of birth?", cat: "👤 Identity", p: "high" },
  { q: "Home address with postal code?", cat: "👤 Identity", p: "high" },
  { q: "Personal cell number?", cat: "👤 Identity", p: "high" },
  { q: "Personal email address?", cat: "👤 Identity", p: "high" },
  { q: "Business email address?", cat: "👤 Identity", p: "high" },
  { q: "Dev / secondary email address?", cat: "👤 Identity", p: "medium" },
  { q: "Nationality and citizenship status?", cat: "👤 Identity", p: "medium" },
  { q: "Where is your original birth certificate kept?", cat: "👤 Identity", p: "medium" },
  { q: "Where are your important physical documents stored?", cat: "📄 Documents", p: "high" },
  { q: "Do you have a certified copy of your ID?", cat: "📄 Documents", p: "medium" },
  { q: "Do you have a copy of your ID stored digitally in a safe place?", cat: "📄 Documents", p: "medium" },

  // ─── HEALTH ───
  { q: "Your GP's name, practice, and phone number?", cat: "🏥 Health", p: "high" },
  { q: "Blood type?", cat: "🏥 Health", p: "high" },
  { q: "Any allergies — food, medication, environmental?", cat: "🏥 Health", p: "high" },
  { q: "Any chronic conditions or diagnoses?", cat: "🏥 Health", p: "high" },
  { q: "Current prescription medications and dosages?", cat: "🏥 Health", p: "high" },
  { q: "Current supplements and dosages?", cat: "🏥 Health", p: "medium" },
  { q: "Date of last blood test?", cat: "🏥 Health", p: "medium" },
  { q: "Dentist name, practice, and phone number?", cat: "🏥 Health", p: "high" },
  { q: "Date of last dental checkup?", cat: "🏥 Health", p: "medium" },
  { q: "Optometrist name and last eye test date?", cat: "🏥 Health", p: "medium" },
  { q: "Current glasses or contact lens prescription?", cat: "🏥 Health", p: "medium" },
  { q: "Any surgeries or major medical procedures?", cat: "🏥 Health", p: "medium" },
  { q: "Any hospitalisations in the last 5 years?", cat: "🏥 Health", p: "medium" },
  { q: "Nearest hospital to your home?", cat: "🏥 Health", p: "high" },
  { q: "Nearest hospital to your workplace?", cat: "🏥 Health", p: "high" },
  { q: "Are you on any medical trials or special treatments?", cat: "🏥 Health", p: "low" },
  { q: "Your height and weight?", cat: "🏥 Health", p: "low" },
  { q: "Gym membership — where, cost, expiry?", cat: "🏋️ Fitness", p: "low" },
  { q: "Exercise routine — what, how often?", cat: "🏋️ Fitness", p: "low" },
  { q: "Any physiotherapist or specialist you see regularly?", cat: "🏥 Health", p: "medium" },
  { q: "Mental health support — therapist, counsellor, or psychologist contact?", cat: "🏥 Health", p: "medium" },

  // ─── MEDICAL AID ───
  { q: "Medical aid provider and plan name?", cat: "📋 Medical Aid", p: "high" },
  { q: "Medical aid membership number?", cat: "📋 Medical Aid", p: "high" },
  { q: "Medical aid call centre number?", cat: "📋 Medical Aid", p: "high" },
  { q: "Medical aid emergency evacuation number?", cat: "📋 Medical Aid", p: "high" },
  { q: "Gap cover provider and policy number?", cat: "📋 Medical Aid", p: "medium" },
  { q: "Dental plan or dental cover details?", cat: "📋 Medical Aid", p: "medium" },
  { q: "Medical aid plan renewal date?", cat: "📋 Medical Aid", p: "medium" },
  { q: "Medical savings account balance and reset date?", cat: "📋 Medical Aid", p: "low" },

  // ─── EMERGENCY ───
  { q: "Who gets called first in an emergency?", cat: "🚨 Emergency", p: "high" },
  { q: "Second emergency contact — name and number?", cat: "🚨 Emergency", p: "high" },
  { q: "Third emergency contact — name and number?", cat: "🚨 Emergency", p: "high" },
  { q: "Nearest police station to your home?", cat: "🚨 Emergency", p: "high" },
  { q: "Nearest police station to your workplace?", cat: "🚨 Emergency", p: "medium" },
  { q: "Home alarm company name and contact number?", cat: "🚨 Emergency", p: "high" },
  { q: "Home alarm code?", cat: "🔑 Security", p: "high" },
  { q: "Work/office alarm company and contact number?", cat: "🚨 Emergency", p: "medium" },
  { q: "Armed response company name and account number?", cat: "🚨 Emergency", p: "high" },
  { q: "Plumber emergency contact?", cat: "🚨 Emergency", p: "medium" },
  { q: "Electrician emergency contact?", cat: "🚨 Emergency", p: "medium" },
  { q: "Locksmith number?", cat: "🚨 Emergency", p: "medium" },
  { q: "Roadside assistance or AA membership?", cat: "🚨 Emergency", p: "medium" },
  { q: "Where are spare keys — home, car, office?", cat: "🔑 Security", p: "medium" },
  { q: "Who has a spare key to your home?", cat: "🔑 Security", p: "medium" },

  // ─── FAMILY ───
  { q: "Mother's full name, birthday, and contact number?", cat: "👨‍👩‍👧 Family", p: "high" },
  { q: "Father's full name, birthday, and contact number?", cat: "👨‍👩‍👧 Family", p: "high" },
  { q: "Siblings — names, birthdays, contact numbers?", cat: "👨‍👩‍👧 Family", p: "high" },
  { q: "Partner or spouse full name and birthday?", cat: "👨‍👩‍👧 Family", p: "high" },
  { q: "Relationship anniversary date?", cat: "👨‍👩‍👧 Family", p: "medium" },
  { q: "Children — names and birthdates?", cat: "👨‍👩‍👧 Family", p: "high" },
  { q: "Who is your next of kin for official purposes?", cat: "👨‍👩‍👧 Family", p: "high" },
  { q: "Extended family — grandparents, aunts, uncles who are important contacts?", cat: "👨‍👩‍👧 Family", p: "low" },
  { q: "Family home address and whose name it's in?", cat: "👨‍👩‍👧 Family", p: "medium" },
  { q: "Pet names, breeds, and vet contact?", cat: "🐾 Pets", p: "medium" },
  { q: "Pet microchip numbers?", cat: "🐾 Pets", p: "low" },

  // ─── FINANCE — BANKING ───
  { q: "Primary bank name and branch code?", cat: "💰 Finance", p: "high" },
  { q: "Primary account number and account type?", cat: "💰 Finance", p: "high" },
  { q: "Secondary bank or savings account details?", cat: "💰 Finance", p: "medium" },
  { q: "SARS tax number?", cat: "💰 Finance", p: "high" },
  { q: "UIF reference number?", cat: "💰 Finance", p: "high" },
  { q: "Tax year-end date?", cat: "💰 Finance", p: "medium" },
  { q: "Who is your accountant — name, firm, contact?", cat: "💰 Finance", p: "high" },
  { q: "When are provisional tax payments due?", cat: "💰 Finance", p: "high" },
  { q: "Do you have a retirement annuity (RA)? Provider and value?", cat: "💰 Finance", p: "medium" },
  { q: "Any other investments — shares, unit trusts, crypto?", cat: "💰 Finance", p: "medium" },
  { q: "Total outstanding debt — home loan, car, credit cards?", cat: "💰 Finance", p: "medium" },
  { q: "Credit card limits and monthly spend?", cat: "💰 Finance", p: "medium" },
  { q: "Monthly personal salary or drawings from the business?", cat: "💰 Finance", p: "medium" },
  { q: "Monthly fixed personal expenses total?", cat: "💰 Finance", p: "medium" },
  { q: "Monthly variable personal expenses average?", cat: "💰 Finance", p: "low" },
  { q: "Online banking username or login hint?", cat: "💰 Finance", p: "medium" },
  { q: "Financial advisor name and contact?", cat: "💰 Finance", p: "medium" },
  { q: "Business bank account details?", cat: "💰 Finance", p: "high" },
  { q: "Business credit card or overdraft facility details?", cat: "💰 Finance", p: "medium" },
  { q: "Annual personal income last tax year?", cat: "💰 Finance", p: "medium" },

  // ─── INSURANCE ───
  { q: "Car insurance provider, policy number, and premium?", cat: "📋 Insurance", p: "high" },
  { q: "Car insurance excess amount?", cat: "📋 Insurance", p: "high" },
  { q: "Car insurance emergency claim number?", cat: "📋 Insurance", p: "high" },
  { q: "Home contents insurance — provider, policy, and value covered?", cat: "📋 Insurance", p: "high" },
  { q: "Home contents insurance excess?", cat: "📋 Insurance", p: "medium" },
  { q: "Public liability insurance — provider and policy number?", cat: "📋 Insurance", p: "medium" },
  { q: "Business insurance — all-risk or equipment cover?", cat: "📋 Insurance", p: "high" },
  { q: "Life insurance — provider, policy number, sum assured?", cat: "📋 Insurance", p: "high" },
  { q: "Life insurance beneficiary?", cat: "📋 Insurance", p: "high" },
  { q: "Disability or income protection cover?", cat: "📋 Insurance", p: "medium" },
  { q: "All insurance premium renewals — dates and amounts?", cat: "📋 Insurance", p: "medium" },
  { q: "Total monthly insurance spend?", cat: "📋 Insurance", p: "medium" },

  // ─── HOME ───
  { q: "JHB home address with postal code?", cat: "🏠 Home", p: "high" },
  { q: "Do you rent or own in JHB?", cat: "🏠 Home", p: "high" },
  { q: "If renting — monthly rent, lease end date, landlord contact?", cat: "🏠 Home", p: "high" },
  { q: "Home Wi-Fi SSID and password?", cat: "🏠 Home", p: "medium" },
  { q: "ISP name, package speed, monthly cost, account number?", cat: "🏠 Home", p: "medium" },
  { q: "Electricity account number and utility provider?", cat: "🏠 Home", p: "medium" },
  { q: "Water account number?", cat: "🏠 Home", p: "low" },
  { q: "Monthly utilities costs (electricity, water, rates)?", cat: "🏠 Home", p: "medium" },
  { q: "Body corporate or estate fees if applicable?", cat: "🏠 Home", p: "medium" },
  { q: "Property manager or agent contact?", cat: "🏠 Home", p: "medium" },
  { q: "Trusted plumber name and number?", cat: "🏠 Home", p: "medium" },
  { q: "Trusted electrician name and number?", cat: "🏠 Home", p: "medium" },
  { q: "Trusted handyman name and number?", cat: "🏠 Home", p: "low" },
  { q: "Home cleaning service — name, frequency, cost?", cat: "🏠 Home", p: "low" },
  { q: "Garden service — name, frequency, cost?", cat: "🏠 Home", p: "low" },
  { q: "Paint colours used at home — brand and name?", cat: "🏠 Home", p: "low" },
  { q: "Any appliances under warranty — make, serial number, expiry?", cat: "🏠 Home", p: "medium" },

  // ─── VEHICLE ───
  { q: "Vehicle make, model, year, and colour?", cat: "🚗 Vehicle", p: "high" },
  { q: "Vehicle registration number?", cat: "🚗 Vehicle", p: "high" },
  { q: "VIN number?", cat: "🚗 Vehicle", p: "medium" },
  { q: "Vehicle licence disc renewal date?", cat: "🚗 Vehicle", p: "high" },
  { q: "Next service date and mileage?", cat: "🚗 Vehicle", p: "high" },
  { q: "Service provider / mechanic name and number?", cat: "🚗 Vehicle", p: "high" },
  { q: "Current mileage?", cat: "🚗 Vehicle", p: "low" },
  { q: "Tyre size?", cat: "🚗 Vehicle", p: "low" },
  { q: "Finance details — bank, monthly payment, balloon/end date?", cat: "🚗 Vehicle", p: "high" },
  { q: "Where is the vehicle registration document kept?", cat: "🚗 Vehicle", p: "medium" },
  { q: "Do you have a dashcam? Where is footage stored?", cat: "🚗 Vehicle", p: "low" },
  { q: "Tracking company name and account number?", cat: "🚗 Vehicle", p: "medium" },

  // ─── LEGAL ───
  { q: "Do you have a will? Where is it kept?", cat: "📋 Legal", p: "high" },
  { q: "Who is your estate executor?", cat: "📋 Legal", p: "high" },
  { q: "Attorney name, firm, and contact?", cat: "📋 Legal", p: "high" },
  { q: "Is there a power of attorney in place?", cat: "📋 Legal", p: "medium" },
  { q: "Business registration number (company / CC / sole prop)?", cat: "📋 Legal", p: "high" },
  { q: "Company registration date?", cat: "📋 Legal", p: "medium" },
  { q: "Directors or shareholders of the business entity?", cat: "📋 Legal", p: "high" },
  { q: "VAT registration number?", cat: "💰 Finance", p: "high" },
  { q: "Any outstanding legal matters or disputes?", cat: "📋 Legal", p: "medium" },
  { q: "Trademarks or intellectual property registered?", cat: "📋 Legal", p: "low" },

  // ─── SMASH BURGER BAR — OPERATIONS ───
  { q: "Full menu with all items and current prices?", cat: "🍔 Restaurant", p: "high" },
  { q: "Trading hours — weekdays vs weekends?", cat: "🍔 Restaurant", p: "high" },
  { q: "Restaurant seating capacity?", cat: "🍔 Restaurant", p: "medium" },
  { q: "Average number of covers per day?", cat: "🍔 Restaurant", p: "medium" },
  { q: "Busiest day and time of week?", cat: "📊 Metrics", p: "high" },
  { q: "Slowest day and time of week?", cat: "📊 Metrics", p: "medium" },
  { q: "Average spend per head?", cat: "📊 Metrics", p: "high" },
  { q: "Best-selling items — top 5?", cat: "📊 Metrics", p: "high" },
  { q: "Worst-selling items worth removing?", cat: "📊 Metrics", p: "medium" },
  { q: "Current food cost percentage target?", cat: "📊 Metrics", p: "high" },
  { q: "Actual food cost percentage last month?", cat: "📊 Metrics", p: "high" },
  { q: "Gross profit margin target?", cat: "📊 Metrics", p: "high" },
  { q: "Monthly revenue target?", cat: "📊 Metrics", p: "high" },
  { q: "Monthly revenue last month?", cat: "📊 Metrics", p: "high" },
  { q: "Monthly revenue best month ever?", cat: "📊 Metrics", p: "medium" },
  { q: "Net profit last month?", cat: "📊 Metrics", p: "high" },
  { q: "Monthly fixed costs total?", cat: "📊 Metrics", p: "high" },
  { q: "Monthly variable costs average?", cat: "📊 Metrics", p: "medium" },
  { q: "Break-even monthly revenue?", cat: "📊 Metrics", p: "high" },
  { q: "Total startup or setup cost of the venture?", cat: "📊 Metrics", p: "medium" },
  { q: "When did you break even from initial costs?", cat: "📊 Metrics", p: "medium" },

  // ─── WORKPLACE & PROPERTY ───
  { q: "Monthly rent or bond payment amount and due date?", cat: "🏢 Workplace", p: "high" },
  { q: "Lease start and end date?", cat: "🏢 Workplace", p: "high" },
  { q: "Annual rent escalation percentage?", cat: "🏢 Workplace", p: "medium" },
  { q: "Landlord or property manager name and contact?", cat: "🏢 Workplace", p: "high" },
  { q: "Rental deposit amount and where is it held?", cat: "🏢 Workplace", p: "medium" },
  { q: "Are utilities included in rent or separate?", cat: "🏢 Workplace", p: "medium" },

  // ─── PROFESSIONAL CONTACTS ───
  { q: "Accountant firm name, address, and main contact?", cat: "📇 Contacts", p: "high" },
  { q: "Attorney firm name and contact?", cat: "📇 Contacts", p: "high" },
  { q: "Financial advisor name and contact?", cat: "📇 Contacts", p: "medium" },
  { q: "Trusted mentor or advisor contact?", cat: "📇 Contacts", p: "medium" },
  { q: "Bank relationship manager name and contact?", cat: "📇 Contacts", p: "medium" },
  { q: "Insurance broker name and contact?", cat: "📇 Contacts", p: "medium" },
  { q: "Key contractors you use regularly — names and what they do?", cat: "👷 Contractors", p: "medium" },
  { q: "Anyone who's offered to help with something — capture it before you forget?", cat: "📇 Contacts", p: "medium" },
  { q: "Key friends — names and contact numbers?", cat: "📇 Contacts", p: "low" },

  // ─── TECHNOLOGY & DIGITAL ───
  { q: "Domain names you own?", cat: "💻 Tech", p: "high" },
  { q: "Domain registrar and renewal dates?", cat: "💻 Tech", p: "high" },
  { q: "Hosting provider and monthly cost?", cat: "💻 Tech", p: "medium" },
  { q: "GitHub or code repository username?", cat: "💻 Tech", p: "medium" },
  { q: "Any SaaS tools you pay for — list with costs?", cat: "💻 Tech", p: "medium" },
  { q: "Password manager — do you use one?", cat: "🔑 Security", p: "high" },
  { q: "Two-factor authentication set up on critical accounts?", cat: "🔑 Security", p: "high" },
  { q: "Cloud backup solution — what and where?", cat: "💻 Tech", p: "medium" },
  { q: "Phone model, IMEI, and warranty details?", cat: "💻 Tech", p: "medium" },
  { q: "Laptop/PC make, model, and warranty details?", cat: "💻 Tech", p: "medium" },
  { q: "Internet provider and line speed at home and work?", cat: "💻 Tech", p: "medium" },
  { q: "Backup internet or power failover plan?", cat: "💻 Tech", p: "medium" },
  { q: "Important account recovery backup emails or phone numbers?", cat: "🔑 Security", p: "high" },
  { q: "SARS eFiling login email address?", cat: "🔑 Security", p: "high" },

  // ─── GOALS & VISION ───
  { q: "1-year personal goal?", cat: "🎯 Goals", p: "high" },
  { q: "5-year vision — where do you want to be?", cat: "🎯 Goals", p: "high" },
  { q: "Personal financial goal for this year?", cat: "🎯 Goals", p: "high" },
  { q: "Personal financial goal in 5 years?", cat: "🎯 Goals", p: "medium" },
  { q: "Biggest challenge you're facing right now?", cat: "🎯 Goals", p: "high" },
  { q: "What skill do you most want to develop this year?", cat: "📚 Growth", p: "medium" },
  { q: "Dream scenario in 10 years — where are you?", cat: "🎯 Goals", p: "low" },
  { q: "Where do you want to be living in 5 years?", cat: "🎯 Goals", p: "low" },
  { q: "Do you have a retirement plan? At what age do you want to retire?", cat: "🎯 Goals", p: "medium" },
  { q: "Side income streams currently or planned?", cat: "💡 Ideas", p: "medium" },
  { q: "Business or project ideas you haven't acted on yet?", cat: "💡 Ideas", p: "low" },
  { q: "Property investment — is this on your radar?", cat: "💡 Ideas", p: "medium" },

  // ─── SUBSCRIPTIONS & RECURRING COSTS ───
  { q: "Streaming subscriptions — which ones and monthly cost?", cat: "💳 Subscriptions", p: "low" },
  { q: "Music subscription — provider and cost?", cat: "💳 Subscriptions", p: "low" },
  { q: "Design or creative tool subscriptions?", cat: "💳 Subscriptions", p: "medium" },
  { q: "Productivity suite — Microsoft 365 or Google Workspace?", cat: "💳 Subscriptions", p: "medium" },
  { q: "Any unused subscriptions to cancel?", cat: "💳 Subscriptions", p: "medium" },
  { q: "Total monthly subscription spend?", cat: "💳 Subscriptions", p: "medium" },
  { q: "Cloud storage subscriptions — iCloud, Google Drive, Dropbox?", cat: "💳 Subscriptions", p: "low" },

  // ─── DAILY LIFE ───
  { q: "Morning routine — what does a typical morning look like?", cat: "☀️ Daily Life", p: "low" },
  { q: "How do you commute to work?", cat: "☀️ Daily Life", p: "low" },
  { q: "Preferred airline and frequent flyer number?", cat: "✈️ Travel", p: "medium" },
  { q: "Preferred supermarket for personal shopping?", cat: "☀️ Daily Life", p: "low" },
  { q: "Barber or hairdresser name and contact?", cat: "☀️ Daily Life", p: "low" },
  { q: "Clothing sizes — shirt, pants, shoes?", cat: "🛒 Personal", p: "low" },
  { q: "Hobbies or activities outside work?", cat: "☀️ Daily Life", p: "low" },
  { q: "Books you're reading or want to read?", cat: "📚 Growth", p: "low" },
  { q: "Podcasts you listen to regularly?", cat: "📚 Growth", p: "low" },
  { q: "Favourite books that shaped your thinking?", cat: "📚 Growth", p: "low" },
  { q: "What's your usual coffee or drink order?", cat: "🍽️ Food", p: "low" },
  { q: "Any foods you avoid or are allergic to?", cat: "🍽️ Food", p: "low" },
  { q: "Preferred clothing stores?", cat: "🛒 Personal", p: "low" },

  // ─── TRAVEL ───
  { q: "Countries you've visited?", cat: "✈️ Travel", p: "low" },
  { q: "Countries on your bucket list?", cat: "✈️ Travel", p: "low" },
  { q: "Do you need a visa for any planned destinations?", cat: "✈️ Travel", p: "medium" },
  { q: "Passport expiry date — is it valid for everywhere you want to go?", cat: "✈️ Travel", p: "high" },
  { q: "Travel insurance — do you have it and from where?", cat: "✈️ Travel", p: "medium" },
  { q: "International roaming plan for your phone?", cat: "✈️ Travel", p: "low" },

  // ─── REFLECTIONS ───
  { q: "What have been your biggest lessons in life or work so far?", cat: "💡 Reflection", p: "low" },
  { q: "What are you most proud of in the last 12 months?", cat: "💡 Reflection", p: "low" },
  { q: "Who has had the biggest positive influence on you?", cat: "💡 Reflection", p: "low" },
  { q: "What recurring problem do you want to permanently fix this year?", cat: "💡 Reflection", p: "medium" },
  { q: "What are you avoiding that you know you should address?", cat: "💡 Reflection", p: "medium" },
  { q: "If money wasn't an issue, what would you spend your time on?", cat: "💡 Ideas", p: "low" },

  // ─── KEY DATES ───
  { q: "Your birthday — captured with the year?", cat: "📅 Dates", p: "medium" },
  { q: "All important renewal dates in one place?", cat: "📅 Dates", p: "high" },
  { q: "All insurance renewal dates?", cat: "📅 Dates", p: "high" },
  { q: "Vehicle licence disc renewal date?", cat: "📅 Dates", p: "high" },
  { q: "Driving licence renewal date?", cat: "📅 Dates", p: "high" },
  { q: "Passport renewal date (flag 6 months before expiry)?", cat: "📅 Dates", p: "high" },
  { q: "Annual tax return deadline?", cat: "📅 Dates", p: "high" },
  { q: "Provisional tax payment dates?", cat: "📅 Dates", p: "high" },
  { q: "When does your medical aid annual premium increase take effect?", cat: "📅 Dates", p: "medium" },
  { q: "Lease renewal negotiation start date (6 months before expiry)?", cat: "📅 Dates", p: "high" },

  // ─── EMERGENCY NUMBERS ───
  { q: "Emergency services numbers saved — police, ambulance, fire?", cat: "📞 Numbers", p: "high" },
  { q: "Private ambulance / medical emergency number?", cat: "📞 Numbers", p: "high" },
  { q: "Poison control helpline number?", cat: "📞 Numbers", p: "medium" },
  { q: "Mental health crisis line number?", cat: "📞 Numbers", p: "medium" },
  { q: "Utility fault reporting numbers — electricity, water?", cat: "📞 Numbers", p: "medium" },
  { q: "SARS helpline number?", cat: "📞 Numbers", p: "medium" },

  // ─── HOME ───
  { q: "Municipality account number for rates and services?", cat: "🏠 Home", p: "medium" },
  { q: "What type of geyser or water heater do you have? How old?", cat: "🏠 Home", p: "low" },
  { q: "Last electrical compliance inspection date at home?", cat: "🏠 Home", p: "medium" },
  { q: "Do you have a generator or inverter at home? Specs and battery runtime?", cat: "🏠 Home", p: "medium" },
  { q: "Gate or garage door brand and installer's contact?", cat: "🏠 Home", p: "low" },

  // ─── VEHICLE ───
  { q: "Last vehicle service date and mileage?", cat: "🚗 Vehicle", p: "medium" },
  { q: "Engine number — where is it recorded?", cat: "🚗 Vehicle", p: "low" },
  { q: "Is the spare wheel full size or space saver?", cat: "🚗 Vehicle", p: "low" },
  { q: "Current tyre brand on all four wheels?", cat: "🚗 Vehicle", p: "low" },

  // ─── DOCUMENTS ───
  { q: "Marriage certificate — where is it kept?", cat: "📄 Documents", p: "medium" },
  { q: "Academic certificates or qualifications — where are they stored?", cat: "📄 Documents", p: "medium" },
  { q: "Any other professional certificates worth capturing?", cat: "📄 Documents", p: "low" },
  { q: "Preferred pharmacy — name and location?", cat: "🏥 Health", p: "medium" },
  { q: "Vaccination history — Covid, flu, travel vaccines worth noting?", cat: "🏥 Health", p: "low" },

  // ─── BRAND & MARKETING (IF APPLICABLE) ───
  { q: "Brand colour palette with hex codes?", cat: "📣 Marketing", p: "medium" },
  { q: "Master logo file — where is it stored?", cat: "📣 Marketing", p: "medium" },
  { q: "Social media handles — which platforms and what's the username?", cat: "📣 Marketing", p: "medium" },
  { q: "Google Business profile — verified and up to date?", cat: "📣 Marketing", p: "medium" },

].sort((a, b) => {
  const w = { high: 3, medium: 2, low: 1 };
  return (w[b.p] || 0) - (w[a.p] || 0) + (Math.random() - 0.5) * 0.5;
});

// ─── FAMILY BRAIN QUESTIONS ──────────────────────────────────────────────────
export const FAMILY_SUGGESTIONS = [
  // ─── FAMILY MEMBERS ───
  { q: "Full names and dates of birth of all family members?", cat: "👨‍👩‍👧 Family", p: "high" },
  { q: "ID numbers for each family member?", cat: "👨‍👩‍👧 Family", p: "high" },
  { q: "Passport numbers and expiry dates for each family member?", cat: "👨‍👩‍👧 Family", p: "high" },
  { q: "Each family member's cell number?", cat: "👨‍👩‍👧 Family", p: "high" },
  { q: "Each family member's email address?", cat: "👨‍👩‍👧 Family", p: "medium" },

  // ─── HOUSEHOLD ───
  { q: "Home address and postal code?", cat: "🏠 Household", p: "high" },
  { q: "Landlord or property manager name and number (if renting)?", cat: "🏠 Household", p: "high" },
  { q: "Home Wi-Fi network name and password?", cat: "🏠 Household", p: "medium" },
  { q: "Monthly rent or bond payment amount and due date?", cat: "🏠 Household", p: "high" },
  { q: "Rates and utilities accounts — account numbers?", cat: "🏠 Household", p: "medium" },
  { q: "Home alarm system code and armed response company number?", cat: "🏠 Household", p: "high" },
  { q: "Armed response account number and technician number?", cat: "🏠 Household", p: "high" },
  { q: "Gate/garage door remote codes?", cat: "🏠 Household", p: "medium" },
  { q: "Plumber contact number?", cat: "🏠 Household", p: "medium" },
  { q: "Electrician contact number?", cat: "🏠 Household", p: "medium" },
  { q: "Garden service / domestic worker name, days, and rate?", cat: "🏠 Household", p: "low" },
  { q: "Refuse collection day and municipal contact?", cat: "🏠 Household", p: "low" },

  // ─── CHILDREN ───
  { q: "Children's school names and physical addresses?", cat: "🎒 Children", p: "high" },
  { q: "School contact numbers and principal's name?", cat: "🎒 Children", p: "high" },
  { q: "Class teacher names for each child?", cat: "🎒 Children", p: "medium" },
  { q: "School WhatsApp group details for each child?", cat: "🎒 Children", p: "medium" },
  { q: "School term dates for the year?", cat: "🎒 Children", p: "medium" },
  { q: "Each child's GP and medical aid membership number?", cat: "🎒 Children", p: "high" },
  { q: "Children's allergies or medical conditions?", cat: "🎒 Children", p: "high" },
  { q: "After-school activities — what, where, time, cost?", cat: "🎒 Children", p: "medium" },
  { q: "Children's device screen time rules or parental controls in place?", cat: "🎒 Children", p: "low" },

  // ─── EMERGENCY ───
  { q: "Emergency meeting point if you can't reach home?", cat: "🚨 Emergency", p: "high" },
  { q: "Nearest hospital and trauma unit to your home?", cat: "🚨 Emergency", p: "high" },
  { q: "Family doctor and after-hours number?", cat: "🚨 Emergency", p: "high" },
  { q: "Poison control number (SA: 0861 555 777)?", cat: "🚨 Emergency", p: "high" },
  { q: "Who to contact if parents are unreachable — trusted adult name and number?", cat: "🚨 Emergency", p: "high" },
  { q: "Medical aid emergency number for each family member's plan?", cat: "🚨 Emergency", p: "high" },

  // ─── SHARED FINANCES ───
  { q: "Shared bank account details and who has access?", cat: "💳 Finances", p: "high" },
  { q: "Monthly household budget — total income vs total expenses?", cat: "💳 Finances", p: "high" },
  { q: "Major recurring debit orders — what, how much, which account?", cat: "💳 Finances", p: "high" },
  { q: "Family savings goal — what for and how much saved so far?", cat: "💳 Finances", p: "medium" },
  { q: "Life insurance policies — provider, policy number, beneficiaries?", cat: "💳 Finances", p: "high" },
  { q: "Funeral cover provider and policy number?", cat: "💳 Finances", p: "high" },
  { q: "Vehicle insurance — provider, policy number, excess?", cat: "💳 Finances", p: "high" },
  { q: "Household contents insurance — provider and policy number?", cat: "💳 Finances", p: "high" },
  { q: "Who has power of attorney if needed?", cat: "💳 Finances", p: "medium" },
  { q: "Wills — who has them, where are the originals kept?", cat: "💳 Finances", p: "high" },

  // ─── VEHICLES ───
  { q: "Each vehicle's make, model, year, and registration number?", cat: "🚗 Vehicles", p: "high" },
  { q: "Vehicle licence renewal dates and cost?", cat: "🚗 Vehicles", p: "high" },
  { q: "Mechanic name and contact number?", cat: "🚗 Vehicles", p: "medium" },
  { q: "Next service date and mileage for each vehicle?", cat: "🚗 Vehicles", p: "medium" },
  { q: "Roadside assistance provider and number?", cat: "🚗 Vehicles", p: "high" },

  // ─── PETS ───
  { q: "Pets' names, breeds, and vet contact details?", cat: "🐾 Pets", p: "medium" },
  { q: "Pet microchip numbers?", cat: "🐾 Pets", p: "medium" },
  { q: "Pet vaccinations — what, when last done, when due?", cat: "🐾 Pets", p: "medium" },
  { q: "Pet insurance provider and policy number?", cat: "🐾 Pets", p: "low" },

  // ─── DIGITAL ───
  { q: "Streaming subscriptions — which ones and monthly cost?", cat: "💻 Digital", p: "low" },
  { q: "Family cloud storage plan — provider and how much space left?", cat: "💻 Digital", p: "low" },
  { q: "Most important shared passwords (note: store securely)?", cat: "💻 Digital", p: "medium" },

].sort((a, b) => {
  const w = { high: 3, medium: 2, low: 1 };
  return (w[b.p] || 0) - (w[a.p] || 0) + (Math.random() - 0.5) * 0.5;
});

// ─── BUSINESS BRAIN QUESTIONS ─────────────────────────────────────────────────
export const BUSINESS_SUGGESTIONS = [
  // ─── BUSINESS IDENTITY ───
  { q: "Registered business name and trading name (if different)?", cat: "🏢 Business", p: "high" },
  { q: "Business registration number (CIPC)?", cat: "🏢 Business", p: "high" },
  { q: "VAT registration number (if applicable)?", cat: "🏢 Business", p: "high" },
  { q: "Business address and postal address?", cat: "🏢 Business", p: "high" },
  { q: "Business email address and main contact number?", cat: "🏢 Business", p: "high" },
  { q: "Business bank account details (bank, branch code, account number)?", cat: "🏢 Business", p: "high" },
  { q: "Director/owner names and ID numbers (for CIPC records)?", cat: "🏢 Business", p: "high" },
  { q: "Accountant name, firm, and contact details?", cat: "🏢 Business", p: "high" },
  { q: "Business attorney or conveyancer contact?", cat: "🏢 Business", p: "medium" },

  // ─── LICENCES & COMPLIANCE ───
  { q: "Liquor licence number and renewal date?", cat: "📋 Licences", p: "high" },
  { q: "Business licence number and expiry date?", cat: "📋 Licences", p: "high" },
  { q: "Certificate of Acceptability (food health cert) number and renewal date?", cat: "📋 Licences", p: "high" },
  { q: "Fire compliance certificate number and expiry?", cat: "📋 Licences", p: "high" },
  { q: "Health and safety compliance status?", cat: "📋 Licences", p: "medium" },
  { q: "POPIA compliance officer name and contact?", cat: "📋 Licences", p: "medium" },
  { q: "UIF registration number?", cat: "📋 Licences", p: "high" },
  { q: "SARS PAYE reference number?", cat: "📋 Licences", p: "high" },
  { q: "Workers' compensation / COIDA registration number?", cat: "📋 Licences", p: "high" },

  // ─── SUPPLIERS ───
  { q: "Primary stock or raw material supplier — name, rep, account number?", cat: "📦 Suppliers", p: "high" },
  { q: "Secondary or backup supplier — name and contact?", cat: "📦 Suppliers", p: "high" },
  { q: "Consumables supplier (packaging, cleaning, office) — account number?", cat: "📦 Suppliers", p: "high" },
  { q: "Utilities supplier — electricity, gas, water — account numbers?", cat: "📦 Suppliers", p: "high" },
  { q: "Uniforms or workwear supplier?", cat: "📦 Suppliers", p: "low" },
  { q: "POS or billing system provider and support number?", cat: "📦 Suppliers", p: "high" },
  { q: "Payment terminal provider and support number?", cat: "📦 Suppliers", p: "high" },
  { q: "Internet/Wi-Fi provider and support number for the business?", cat: "📦 Suppliers", p: "high" },
  { q: "Payment terms with each major supplier?", cat: "📦 Suppliers", p: "high" },
  { q: "Which suppliers offer credit and what are the limits?", cat: "📦 Suppliers", p: "medium" },

  // ─── STAFF ───
  { q: "Full-time staff list — names, roles, ID numbers, cell numbers?", cat: "👥 Staff", p: "high" },
  { q: "Part-time staff list — names, availability, cell numbers?", cat: "👥 Staff", p: "high" },
  { q: "Payroll frequency and method — weekly/monthly, EFT/cash?", cat: "👥 Staff", p: "high" },
  { q: "Payday — which day of the week or month?", cat: "👥 Staff", p: "high" },
  { q: "Shift schedule — opening, mid, closing?", cat: "👥 Staff", p: "medium" },
  { q: "Who is responsible for banking daily takings?", cat: "👥 Staff", p: "high" },
  { q: "Who has keys to the premises?", cat: "👥 Staff", p: "high" },
  { q: "Emergency contact for each staff member?", cat: "👥 Staff", p: "medium" },
  { q: "Any staff contracts in place — where are they stored?", cat: "👥 Staff", p: "high" },

  // ─── EQUIPMENT ───
  { q: "Commercial fridge/freezer — make, model, supplier, warranty expiry?", cat: "⚙️ Equipment", p: "high" },
  { q: "Grill / flat top — make, model, service contact?", cat: "⚙️ Equipment", p: "high" },
  { q: "Deep fryer — make, model, last service date?", cat: "⚙️ Equipment", p: "medium" },
  { q: "Fire extinguishers — how many, last inspection date, next due?", cat: "⚙️ Equipment", p: "high" },
  { q: "Hood / extraction fan — last cleaning date, service contact?", cat: "⚙️ Equipment", p: "high" },
  { q: "POS hardware — serial numbers and warranty info?", cat: "⚙️ Equipment", p: "medium" },
  { q: "CCTV system — provider, recording retention, remote access setup?", cat: "⚙️ Equipment", p: "medium" },

  // ─── SOPs & PROCESSES ───
  { q: "Core product or service delivery process — step by step?", cat: "📖 SOPs", p: "high" },
  { q: "Opening / start-of-day checklist — what must be done before operations begin?", cat: "📖 SOPs", p: "high" },
  { q: "Closing / end-of-day checklist — what must be done before locking up?", cat: "📖 SOPs", p: "high" },
  { q: "Daily cash-up or reconciliation procedure — steps and who is responsible?", cat: "📖 SOPs", p: "high" },
  { q: "Quality control process — how is it checked and by whom?", cat: "📖 SOPs", p: "medium" },
  { q: "Stock take process — how often and who does it?", cat: "📖 SOPs", p: "medium" },
  { q: "Waste or returns tracking process?", cat: "📖 SOPs", p: "low" },

  // ─── COSTS & MARGINS ───
  { q: "Target food cost percentage?", cat: "💰 Costs", p: "high" },
  { q: "Average spend per customer (ATP)?", cat: "💰 Costs", p: "high" },
  { q: "Monthly fixed costs — rent, salaries, utilities total?", cat: "💰 Costs", p: "high" },
  { q: "Break-even daily sales target?", cat: "💰 Costs", p: "high" },
  { q: "Best-selling items and their GP margins?", cat: "💰 Costs", p: "medium" },

  // ─── MARKETING ───
  { q: "Google Business profile — email it's registered under, last updated?", cat: "📣 Marketing", p: "high" },
  { q: "Facebook page — admin email, URL?", cat: "📣 Marketing", p: "high" },
  { q: "Instagram account handle and admin email?", cat: "📣 Marketing", p: "high" },
  { q: "Online marketplace or delivery platform accounts — details and commission rates?", cat: "📣 Marketing", p: "high" },
  { q: "Loyalty program — how does it work and what platform?", cat: "📣 Marketing", p: "medium" },
  { q: "Who creates content / social media posts?", cat: "📣 Marketing", p: "low" },

  // ─── INSURANCE ───
  { q: "Business insurance broker name and contact?", cat: "📋 Insurance", p: "high" },
  { q: "Contents insurance — provider, policy number, what's covered?", cat: "📋 Insurance", p: "high" },
  { q: "Business interruption insurance — provider and what triggers it?", cat: "📋 Insurance", p: "high" },
  { q: "Public liability insurance — policy number and cover amount?", cat: "📋 Insurance", p: "high" },
  { q: "Employer's liability insurance in place?", cat: "📋 Insurance", p: "high" },

].sort((a, b) => {
  const w = { high: 3, medium: 2, low: 1 };
  return (w[b.p] || 0) - (w[a.p] || 0) + (Math.random() - 0.5) * 0.5;
});
