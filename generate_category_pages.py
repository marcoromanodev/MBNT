import os

# Load template
with open('category_template.html') as f:
    template = f.read()

ITEMS_PER_PAGE = 9

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
    {
        "name": "Duffle Bag",
        "price": 80,
        "image": "dufflebag1.png",
        "link": "dufflebag.html",
        "categories": ["bags", "new", "all"],
    },
    {
        "name": "Backpack",
        "price": 60,
        "image": "backpackblack.png",
        "link": "backpack.html",
        "categories": ["bags", "new", "all"],
    },
    {
        "name": "Trucker Hat",
        "price": 50,
        "image": "truckerwhitefront.png",
        "link": "truckerhat.html",
        "categories": ["hats", "new", "all"],
    },
    {
        "name": "Socks",
        "price": 20,
        "image": "blacksocks.png",
        "link": "socks.html",
        "categories": ["accessories", "new", "all"],
    },
    {
        "name": "Skateboard 1",
        "price": 100,
        "image": "skateboard3v2.png",
        "link": "skateboard1.html",
        "categories": ["skate", "new", "all"],
    },
    {
        "name": "Skateboard 2",
        "price": 100,
        "image": "skateboard4.png",
        "link": "skateboard2.html",
        "categories": ["skate", "new", "all"],
    },
    {
        "name": "Skateboard 3",
        "price": 100,
        "image": "skateboard1.png",
        "link": "skateboard3.html",
        "categories": ["skate", "new", "all"],
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
    category_products = [p for p in products if slug in p["categories"]]
    total_pages = max(1, (len(category_products) + ITEMS_PER_PAGE - 1) // ITEMS_PER_PAGE)
    for page_num in range(1, total_pages + 1):
        start = (page_num - 1) * ITEMS_PER_PAGE
        end = start + ITEMS_PER_PAGE
        page_products = category_products[start:end]
        if not page_products:
            items_content = '<div class="coming-soon">Coming Soon..</div>'
        else:
            items = [item_template.format(**prod) for prod in page_products]
            items_content = "\n    ".join(items)

        pagination_links = []
        if page_num > 1:
            prev_file = f"{slug}.html" if page_num == 2 else f"{slug}-page{page_num - 1}.html"
            pagination_links.append(f'<a href="{prev_file}" class="pagination-button">Previous Page</a>')
        if page_num < total_pages:
            next_file = f"{slug}-page{page_num + 1}.html"
            pagination_links.append(f'<a href="{next_file}" class="pagination-button">Next Page</a>')
        if pagination_links:
            pagination_html = '<div class="pagination">' + "\n        ".join(pagination_links) + '</div>'
        else:
            pagination_html = ''

        page = (template.replace("{{TITLE}}", title)
                         .replace("{{ITEMS}}", items_content)
                         .replace("{{PAGINATION}}", pagination_html))

        filename = f"{slug}.html" if page_num == 1 else f"{slug}-page{page_num}.html"
        with open(filename, "w") as f:
            f.write(page)
        print(f"Wrote {filename}")
