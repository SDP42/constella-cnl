"""Static reference data: divisions, product catalogue, solution templates, geography.

Brands are taken from Creative Newtech's investor presentation (Q1 FY26). SKU names, prices,
margins and working-capital days are *synthetic assumptions* for the prototype; they are
ordered realistically (licensed Honeywell + niche FMSG = higher margin, enterprise
hardware = thin margin / long cycle), which matches CNL's own Quadrant framing.
"""

from typing import Any

DIVISIONS: list[dict[str, str]] = [
    {"code": "EB", "name": "Enterprise Business", "color": "#38BDF8",
     "description": "High-volume displays, monitors, signage, storage and compute for enterprises & SIs"},
    {"code": "HON", "name": "Licensed & Own Brands", "color": "#F5B700",
     "description": "Honeywell (38-country licence), AT&T licensing and CNL's own WOZOYO brand"},
    {"code": "FMSG", "name": "Social-Media Gadgets", "color": "#F472B6",
     "description": "Experiential creator & lifestyle gadgets: Instax, Insta360, Lexar, Cricut, ZEISS"},
    {"code": "FMCT", "name": "Consumer Technology", "color": "#A78BFA",
     "description": "Gaming, PC components, mobile accessories and premium audio"},
    {"code": "SVC", "name": "Services & Annuity", "color": "#22C55E",
     "description": "AMC, filter subscriptions, device-as-a-service, CMS licences, certification"},
]

# category -> (division, brands, base price INR, margin, wc_days, recurring_period_months|None)
CATEGORIES: dict[str, dict[str, Any]] = {
    # Enterprise Business — thin margin, long cycle
    "interactive_display": {"div": "EB", "label": "Interactive Flat Panels", "brands": ["ViewSonic", "Samsung"], "price": 185000, "margin": 0.07, "wc": 75},
    "commercial_monitor": {"div": "EB", "label": "Commercial Monitors", "brands": ["AOC", "ViewSonic", "Samsung"], "price": 14500, "margin": 0.045, "wc": 55},
    "digital_signage": {"div": "EB", "label": "Digital Signage", "brands": ["Samsung", "Philips"], "price": 92000, "margin": 0.08, "wc": 70},
    "projector": {"div": "EB", "label": "Projectors", "brands": ["ViewSonic"], "price": 48000, "margin": 0.06, "wc": 60},
    "enterprise_storage": {"div": "EB", "label": "SSD & Storage", "brands": ["Samsung", "Lexar"], "price": 9800, "margin": 0.05, "wc": 40},
    "mini_pc": {"div": "EB", "label": "Mini PCs", "brands": ["MSI"], "price": 42000, "margin": 0.055, "wc": 60},
    "retail_security": {"div": "EB", "label": "Retail Security", "brands": ["InVue"], "price": 26000, "margin": 0.11, "wc": 65},
    # Honeywell licensing — higher margin, quick cycle (Quadrant 1)
    "structured_cabling": {"div": "HON", "label": "Structured Cabling", "brands": ["Honeywell"], "price": 38000, "margin": 0.17, "wc": 35},
    "connectivity": {"div": "HON", "label": "Connectivity & Hubs", "brands": ["Honeywell"], "price": 2400, "margin": 0.22, "wc": 25},
    "air_purifier": {"div": "HON", "label": "Air Purifiers", "brands": ["Honeywell"], "price": 16500, "margin": 0.19, "wc": 30},
    "home_audio": {"div": "HON", "label": "Audio Systems", "brands": ["Honeywell"], "price": 8900, "margin": 0.2, "wc": 30},
    # FMSG — experiential, higher margin, fast
    "instant_camera": {"div": "FMSG", "label": "Instant Cameras", "brands": ["Fujifilm Instax"], "price": 7800, "margin": 0.16, "wc": 28},
    "action_camera": {"div": "FMSG", "label": "Action & 360 Cameras", "brands": ["Insta360"], "price": 38000, "margin": 0.12, "wc": 32},
    "memory_cards": {"div": "FMSG", "label": "Memory Cards", "brands": ["Lexar"], "price": 1900, "margin": 0.14, "wc": 22},
    "crafting": {"div": "FMSG", "label": "Smart Cutting Machines", "brands": ["Cricut"], "price": 32000, "margin": 0.18, "wc": 40},
    "optics": {"div": "FMSG", "label": "Optics & Imaging", "brands": ["ZEISS", "Olympus"], "price": 41000, "margin": 0.13, "wc": 45},
    "video_accessories": {"div": "FMSG", "label": "Video Rigs & Accessories", "brands": ["Hama", "Edelkrone"], "price": 6200, "margin": 0.21, "wc": 35},
    "smart_wearable": {"div": "FMSG", "label": "Smart Rings", "brands": ["Aabo Ring"], "price": 14900, "margin": 0.2, "wc": 30},
    # FMCT — consumer tech
    "gaming_peripherals": {"div": "FMCT", "label": "Gaming Peripherals", "brands": ["Cooler Master"], "price": 5400, "margin": 0.15, "wc": 30},
    "pc_components": {"div": "FMCT", "label": "PC Components", "brands": ["Cooler Master", "Colorful"], "price": 11500, "margin": 0.09, "wc": 38},
    "gaming_pc": {"div": "FMCT", "label": "Gaming PCs", "brands": ["CyberPowerPC"], "price": 128000, "margin": 0.1, "wc": 45},
    "mobile_accessories": {"div": "FMCT", "label": "Mobile Accessories", "brands": ["pTron"], "price": 1100, "margin": 0.12, "wc": 20},
    "premium_audio": {"div": "FMCT", "label": "Premium Audio", "brands": ["Ruark Audio"], "price": 46000, "margin": 0.18, "wc": 50},
    "recovery_fitness": {"div": "FMCT", "label": "Recovery & Fitness", "brands": ["Hyperice"], "price": 24000, "margin": 0.17, "wc": 40},
    "ai_workstation": {"div": "FMCT", "label": "AI Workstations", "brands": ["CyberPowerPC"], "price": 385000, "margin": 0.12, "wc": 45},
    # Newer lines disclosed in the Q2 FY27 call (Oct 2026)
    "surveillance": {"div": "EB", "label": "Surveillance Cameras", "brands": ["Infinova"], "price": 68000, "margin": 0.16, "wc": 60},
    "fire_safety": {"div": "EB", "label": "Fire & Life Safety", "brands": ["Ravel"], "price": 54000, "margin": 0.15, "wc": 55},
    "ai_server": {"div": "EB", "label": "AI / GPU Servers", "brands": ["Super Micro"], "price": 2400000, "margin": 0.06, "wc": 70},
    "drone_kits": {"div": "FMSG", "label": "Drone STEM Kits", "brands": ["Drona Aviation"], "price": 46000, "margin": 0.19, "wc": 40},
    "wozoyo_accessories": {"div": "HON", "label": "WOZOYO Essentials", "brands": ["WOZOYO"], "price": 3900, "margin": 0.28, "wc": 25},
    # Services & annuity — recurring, very high margin, near-zero inventory
    "filter_subscription": {"div": "SVC", "label": "Purifier Filter Subscription", "brands": ["Honeywell"], "price": 3200, "margin": 0.34, "wc": 10, "recurring": 6},
    "display_amc": {"div": "SVC", "label": "Display & AV AMC", "brands": ["Constella Care"], "price": 12000, "margin": 0.42, "wc": 5, "recurring": 12},
    "cabling_certification": {"div": "SVC", "label": "Cabling Certification & Audit", "brands": ["Honeywell"], "price": 18000, "margin": 0.38, "wc": 5, "recurring": 12},
    "signage_cms": {"div": "SVC", "label": "Signage CMS Licence", "brands": ["Constella Cloud"], "price": 6000, "margin": 0.55, "wc": 0, "recurring": 12},
    "device_as_a_service": {"div": "SVC", "label": "Device-as-a-Service", "brands": ["Constella Flex"], "price": 4200, "margin": 0.24, "wc": 15, "recurring": 1},
    "extended_warranty": {"div": "SVC", "label": "Extended Warranty", "brands": ["Constella Care"], "price": 2600, "margin": 0.48, "wc": 0, "recurring": 12},
}

ANNUITY_FOR: dict[str, str] = {
    "air_purifier": "filter_subscription",
    "interactive_display": "display_amc",
    "projector": "display_amc",
    "structured_cabling": "cabling_certification",
    "digital_signage": "signage_cms",
    "gaming_pc": "extended_warranty",
    "action_camera": "extended_warranty",
    "mini_pc": "device_as_a_service",
    "surveillance": "display_amc",
    "ai_workstation": "extended_warranty",
}

SOLUTIONS: list[dict[str, Any]] = [
    {
        "id": "smart_classroom", "name": "Smart Classroom", "icon": "graduation-cap",
        "tagline": "Interactive panels, campus cabling and managed AV for schools & colleges",
        "verticals": ["education", "government"],
        "components": [
            {"category": "interactive_display", "role": "Teaching surface", "required": True, "per100": 6},
            {"category": "structured_cabling", "role": "Classroom network backbone", "required": True, "per100": 3},
            {"category": "mini_pc", "role": "Board-side compute", "required": True, "per100": 6},
            {"category": "connectivity", "role": "HDMI / USB-C hubs", "required": False, "per100": 12},
            {"category": "projector", "role": "Auditorium projection", "required": False, "per100": 1},
        ],
        "annuity": [{"category": "display_amc", "per100": 6}, {"category": "cabling_certification", "per100": 1}],
    },
    {
        "id": "hybrid_meeting_room", "name": "Hybrid Meeting Room", "icon": "presentation",
        "tagline": "Boardroom-grade collaboration for BFSI and IT offices",
        "verticals": ["bfsi", "it_ites", "manufacturing"],
        "components": [
            {"category": "interactive_display", "role": "Collaboration wall", "required": True, "per100": 2},
            {"category": "mini_pc", "role": "Room compute", "required": True, "per100": 2},
            {"category": "home_audio", "role": "Room audio", "required": True, "per100": 2},
            {"category": "connectivity", "role": "Table connectivity", "required": False, "per100": 6},
            {"category": "commercial_monitor", "role": "Huddle screens", "required": False, "per100": 8},
        ],
        "annuity": [{"category": "display_amc", "per100": 2}, {"category": "device_as_a_service", "per100": 2}],
    },
    {
        "id": "healthy_workplace", "name": "Healthy Workplace", "icon": "wind",
        "tagline": "Clean-air offices with filter subscriptions that renew themselves",
        "verticals": ["it_ites", "bfsi", "healthcare", "hospitality", "education"],
        "components": [
            {"category": "air_purifier", "role": "Clean air per 400 sq ft", "required": True, "per100": 8},
            {"category": "commercial_monitor", "role": "AQI dashboards", "required": False, "per100": 1},
        ],
        "annuity": [{"category": "filter_subscription", "per100": 16}],
    },
    {
        "id": "retail_experience", "name": "Experience Store", "icon": "store",
        "tagline": "Signage, loss-prevention and in-store audio for modern retail",
        "verticals": ["retail", "hospitality"],
        "components": [
            {"category": "digital_signage", "role": "Storefront & aisle signage", "required": True, "per100": 4},
            {"category": "retail_security", "role": "Merchandise security", "required": True, "per100": 6},
            {"category": "home_audio", "role": "In-store audio", "required": False, "per100": 3},
            {"category": "structured_cabling", "role": "Store network", "required": False, "per100": 1},
        ],
        "annuity": [{"category": "signage_cms", "per100": 4}],
    },
    {
        "id": "creator_studio", "name": "Creator Studio Kit", "icon": "camera",
        "tagline": "Bundled creator hardware for camera stores and influencer studios",
        "verticals": ["media_creators", "retail"],
        "components": [
            {"category": "action_camera", "role": "Capture", "required": True, "per100": 10},
            {"category": "memory_cards", "role": "Storage media", "required": True, "per100": 30},
            {"category": "video_accessories", "role": "Rigs & mounts", "required": True, "per100": 12},
            {"category": "instant_camera", "role": "Event / instant prints", "required": False, "per100": 8},
            {"category": "premium_audio", "role": "Studio monitoring", "required": False, "per100": 2},
        ],
        "annuity": [{"category": "extended_warranty", "per100": 10}],
    },
    {
        "id": "esports_arena", "name": "Esports & Gaming Lounge", "icon": "gamepad-2",
        "tagline": "Turnkey gaming cafés and campus esports labs",
        "verticals": ["hospitality", "education", "retail"],
        "components": [
            {"category": "gaming_pc", "role": "Rigs", "required": True, "per100": 10},
            {"category": "gaming_peripherals", "role": "Peripherals", "required": True, "per100": 20},
            {"category": "commercial_monitor", "role": "High-refresh displays", "required": True, "per100": 10},
            {"category": "structured_cabling", "role": "Low-latency LAN", "required": False, "per100": 1},
            {"category": "enterprise_storage", "role": "Game library storage", "required": False, "per100": 4},
        ],
        "annuity": [{"category": "extended_warranty", "per100": 10}, {"category": "device_as_a_service", "per100": 5}],
    },
    {
        "id": "clinic_command", "name": "Hospital Patient Experience", "icon": "heart-pulse",
        "tagline": "Wayfinding signage, clean air and resilient networks for hospitals",
        "verticals": ["healthcare"],
        "components": [
            {"category": "digital_signage", "role": "Wayfinding & queue display", "required": True, "per100": 2},
            {"category": "air_purifier", "role": "OPD & ward clean air", "required": True, "per100": 6},
            {"category": "structured_cabling", "role": "Clinical network", "required": True, "per100": 2},
            {"category": "commercial_monitor", "role": "Nurse station screens", "required": False, "per100": 4},
        ],
        "annuity": [{"category": "filter_subscription", "per100": 12}, {"category": "signage_cms", "per100": 2}],
    },
    {
        "id": "smart_campus_network", "name": "Smart Campus Network", "icon": "network",
        "tagline": "Certified structured cabling + connectivity for campuses and plants",
        "verticals": ["education", "manufacturing", "government", "it_ites"],
        "components": [
            {"category": "structured_cabling", "role": "Backbone & horizontal cabling", "required": True, "per100": 4},
            {"category": "connectivity", "role": "Endpoints & hubs", "required": True, "per100": 20},
            {"category": "enterprise_storage", "role": "Edge storage", "required": False, "per100": 3},
            {"category": "digital_signage", "role": "Campus notices", "required": False, "per100": 1},
        ],
        "annuity": [{"category": "cabling_certification", "per100": 2}],
    },
    {
        "id": "smart_city_security", "name": "Smart City & Campus Security", "icon": "shield",
        "tagline": "Infinova surveillance + Ravel fire safety on a certified Honeywell backbone",
        "verticals": ["government", "education", "healthcare", "manufacturing"],
        "components": [
            {"category": "surveillance", "role": "STQC-certified cameras", "required": True, "per100": 6},
            {"category": "fire_safety", "role": "Fire & life safety panels", "required": True, "per100": 2},
            {"category": "structured_cabling", "role": "Camera network backbone", "required": True, "per100": 3},
            {"category": "enterprise_storage", "role": "Video retention storage", "required": False, "per100": 4},
            {"category": "commercial_monitor", "role": "Control-room video wall", "required": False, "per100": 2},
        ],
        "annuity": [{"category": "display_amc", "per100": 6}, {"category": "cabling_certification", "per100": 1}],
    },
    {
        "id": "onprem_ai_pod", "name": "On-prem AI Pod", "icon": "cpu",
        "tagline": "'AI in a box' for BFSI & enterprises that won't send data to the cloud",
        "verticals": ["bfsi", "it_ites", "healthcare", "manufacturing"],
        "components": [
            {"category": "ai_workstation", "role": "CyberPowerPC AI workstations", "required": True, "per100": 2},
            {"category": "ai_server", "role": "Super Micro GPU server", "required": False, "per100": 0.3},
            {"category": "enterprise_storage", "role": "NVMe data tier", "required": True, "per100": 6},
            {"category": "structured_cabling", "role": "High-throughput LAN", "required": False, "per100": 1},
        ],
        "annuity": [{"category": "extended_warranty", "per100": 4}, {"category": "device_as_a_service", "per100": 2}],
    },
    {
        "id": "drone_stem_lab", "name": "Drone STEM Lab", "icon": "plane",
        "tagline": "Drona Aviation drone kits + classroom tech for schools and skilling centres",
        "verticals": ["education", "government"],
        "components": [
            {"category": "drone_kits", "role": "Drone STEM kits", "required": True, "per100": 10},
            {"category": "interactive_display", "role": "Lab teaching panel", "required": True, "per100": 1},
            {"category": "mini_pc", "role": "Programming stations", "required": False, "per100": 6},
            {"category": "memory_cards", "role": "Flight data storage", "required": False, "per100": 20},
        ],
        "annuity": [{"category": "extended_warranty", "per100": 10}],
    },
]

# "If you want Honeywell, stock WOZOYO" — brand-bundle levers (CMD, Q2 FY27 call)
BRAND_BUNDLES: list[dict[str, Any]] = [
    {"id": "honeywell_wozoyo", "anchor": "air_purifier", "attach": "wozoyo_accessories",
     "rule": "Partners who want Honeywell purifiers in season also stock WOZOYO essentials", "attach_rate_target": 0.6},
    {"id": "display_amc", "anchor": "interactive_display", "attach": "display_amc",
     "rule": "Every interactive panel ships with an AMC quote", "attach_rate_target": 0.5},
    {"id": "camera_storage", "anchor": "surveillance", "attach": "enterprise_storage",
     "rule": "Every camera deployment needs retention storage", "attach_rate_target": 0.7},
    {"id": "ai_warranty", "anchor": "ai_workstation", "attach": "extended_warranty",
     "rule": "AI workstations ship with extended warranty", "attach_rate_target": 0.55},
]

VERTICALS = ["education", "healthcare", "retail", "bfsi", "it_ites", "manufacturing",
             "government", "hospitality", "media_creators"]

# city -> (region, lat, lng, pincode prefix)
CITIES: dict[str, tuple[str, float, float, str]] = {
    "Mumbai": ("West", 19.076, 72.8777, "400"), "Pune": ("West", 18.5204, 73.8567, "411"),
    "Ahmedabad": ("West", 23.0225, 72.5714, "380"), "Surat": ("West", 21.1702, 72.8311, "395"),
    "Nagpur": ("West", 21.1458, 79.0882, "440"), "Indore": ("West", 22.7196, 75.8577, "452"),
    "Delhi": ("North", 28.7041, 77.1025, "110"), "Gurugram": ("North", 28.4595, 77.0266, "122"),
    "Noida": ("North", 28.5355, 77.391, "201"), "Jaipur": ("North", 26.9124, 75.7873, "302"),
    "Chandigarh": ("North", 30.7333, 76.7794, "160"), "Lucknow": ("North", 26.8467, 80.9462, "226"),
    "Dehradun": ("North", 30.3165, 78.0322, "248"), "Varanasi": ("North", 25.3176, 82.9739, "221"),
    "Jammu": ("North", 32.7266, 74.857, "180"),
    "Bengaluru": ("South", 12.9716, 77.5946, "560"), "Chennai": ("South", 13.0827, 80.2707, "600"),
    "Hyderabad": ("South", 17.385, 78.4867, "500"), "Kochi": ("South", 9.9312, 76.2673, "682"),
    "Coimbatore": ("South", 11.0168, 76.9558, "641"),
    "Kolkata": ("East", 22.5726, 88.3639, "700"), "Bhubaneswar": ("East", 20.2961, 85.8245, "751"),
    "Guwahati": ("East", 26.1445, 91.7362, "781"), "Patna": ("East", 25.5941, 85.1376, "800"),
}

STATE_CODES = {"West": ["27", "24", "23"], "North": ["07", "06", "09", "08", "04", "05", "01"],
               "South": ["29", "33", "36", "32"], "East": ["19", "21", "18", "10"]}

# Which divisions each account type naturally buys from (prior affinity weights)
TYPE_DIVISION_AFFINITY: dict[str, dict[str, float]] = {
    "system_integrator": {"EB": 1.0, "HON": 0.8, "FMCT": 0.25, "FMSG": 0.1, "SVC": 0.35},
    "enterprise": {"EB": 0.9, "HON": 0.7, "FMCT": 0.2, "FMSG": 0.1, "SVC": 0.5},
    "reseller": {"EB": 0.6, "HON": 0.5, "FMCT": 0.7, "FMSG": 0.5, "SVC": 0.2},
    "retailer": {"EB": 0.15, "HON": 0.45, "FMCT": 0.9, "FMSG": 1.0, "SVC": 0.1},
    "sub_distributor": {"EB": 0.5, "HON": 0.5, "FMCT": 0.9, "FMSG": 0.8, "SVC": 0.05},
}

# Vertical -> categories with elevated latent need
VERTICAL_NEEDS: dict[str, list[str]] = {
    "education": ["interactive_display", "projector", "mini_pc", "structured_cabling", "connectivity", "gaming_pc", "drone_kits", "surveillance"],
    "healthcare": ["digital_signage", "air_purifier", "structured_cabling", "commercial_monitor"],
    "retail": ["digital_signage", "retail_security", "home_audio", "mobile_accessories", "instant_camera", "memory_cards", "wozoyo_accessories"],
    "bfsi": ["interactive_display", "commercial_monitor", "air_purifier", "home_audio", "mini_pc", "ai_workstation", "surveillance"],
    "it_ites": ["commercial_monitor", "air_purifier", "connectivity", "interactive_display", "enterprise_storage", "ai_workstation"],
    "manufacturing": ["structured_cabling", "connectivity", "commercial_monitor", "enterprise_storage"],
    "government": ["interactive_display", "structured_cabling", "digital_signage", "projector", "surveillance", "fire_safety", "drone_kits"],
    "hospitality": ["digital_signage", "home_audio", "air_purifier", "gaming_pc", "gaming_peripherals", "premium_audio"],
    "media_creators": ["action_camera", "memory_cards", "video_accessories", "instant_camera", "optics", "premium_audio"],
}

FIRST_NAMES = ["Aarav", "Vivaan", "Aditya", "Ishaan", "Kabir", "Rohan", "Ananya", "Diya", "Kavya", "Meera",
               "Neha", "Pooja", "Sanjay", "Rahul", "Vikram", "Arjun", "Sneha", "Tanvi", "Farhan", "Zoya",
               "Harpreet", "Gurpreet", "Lakshmi", "Karthik", "Sourav", "Bidisha", "Nikhil", "Riya"]
LAST_NAMES = ["Shah", "Mehta", "Iyer", "Nair", "Reddy", "Kulkarni", "Joshi", "Patel", "Singh", "Gupta",
              "Das", "Banerjee", "Rao", "Menon", "Khan", "Kapoor", "Bose", "Desai", "Pillai", "Chawla"]

COMPANY_STEMS = ["Tech", "Infra", "Digital", "Vision", "Nova", "Prime", "Matrix", "Apex", "Orbit", "Pixel",
                 "Quantum", "Zenith", "Vertex", "Spark", "Bharat", "Sahyadri", "Ganga", "Indus", "Lotus",
                 "Silverline", "Bluechip", "Kaveri", "Everest", "Aryan", "Shree", "Om Sai", "Galaxy", "Unity"]
COMPANY_SUFFIX = {
    "system_integrator": ["Systems", "Integrators", "Networks", "Solutions", "Infotech"],
    "enterprise": ["Industries", "Hospitals", "Bank", "Group", "Labs", "Education Trust", "Hotels"],
    "reseller": ["Computers", "IT Mart", "Infosys Traders", "Tech World", "Peripherals"],
    "retailer": ["Electronics", "Gadget Hub", "Camera House", "Digital Store", "Mobile Point"],
    "sub_distributor": ["Distributors", "Trading Co", "Agencies", "Marketing", "Enterprises"],
}
