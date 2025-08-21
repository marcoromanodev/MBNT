import os

# Load template
with open('category_template.html') as f:
    template = f.read()

categories = [
    ("new", "New"),
    ("jackets", "Jackets"),
    ("shirts", "Shirts"),
    ("tops-sweaters", "Tops/Sweaters"),
    ("sweatshirts", "Sweatshirts"),
    ("pants", "Pants"),
    ("t-shirts", "T-Shirts"),
    ("hats", "Hats"),
    ("bags", "Bags"),
    ("accessories", "Accessories"),
    ("shoes", "Shoes"),
    ("gym", "Gym"),
    ("skate", "Skate"),
    ("all", "All"),
]

# Define available products with their categories
products = [
    {
        "name": "Hat",
        "price": 50,
        "image": "whitehat.png",
        "link": "hat.html",
        "categories": ["hats", "new", "all"],
    },
    {
        "name": "Hoodie",
        "price": 70,
        "image": "blackhoodie.png",
        "link": "hoodie.html",
        "categories": ["sweatshirts", "new", "all"],
    },
    {
        "name": "T-Shirt",
        "price": 40,
        "image": "whiteshirt.png",
        "link": "shirt.html",
        "categories": ["shirts", "t-shirts", "new", "all"],
    },
    {
        "name": "Joggers",
        "price": 60,
        "image": "blackjoggers.png",
        "link": "joggers.html",
        "categories": ["pants", "new", "all"],
    },
    {
        "name": "Shorts",
        "price": 50,
        "image": "whiteshorts.png",
        "link": "shorts.html",
        "categories": ["pants", "new", "all"],
    },
    {
        "name": "American Denim Jeans",
        "price": 90,
        "image": "bluejeans.png",
        "link": "americandenim.html",
        "categories": ["pants", "new", "all"],
    },
]

item_template = """
<div class=\"product-item\">
    <a href=\"{link}\">
        <img src=\"{image}\" alt=\"{name}\">
        <div class=\"product-info\">
            <p>{name}</p>
            <p>${price}</p>
        </div>
    </a>
</div>"""

for slug, title in categories:
    items = []
    for product in products:
        if slug in product["categories"]:
            items.append(item_template.format(**product))
    if not items:
        items_content = '<div class="coming-soon">Coming Soon..</div>'
    else:
        items_content = "\n    ".join(items)
    page = template.replace("{{TITLE}}", title).replace("{{ITEMS}}", items_content)
    filename = f"{slug}.html"
    with open(filename, "w") as f:
        f.write(page)
    print(f"Wrote {filename}")
