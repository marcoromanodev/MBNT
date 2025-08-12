import os

# Load template
with open('category_template.html') as f:
    template = f.read()

categories = [
    ('new', 'New'),
    ('jackets', 'Jackets'),
    ('shirts', 'Shirts'),
    ('tops-sweaters', 'Tops/Sweaters'),
    ('sweatshirts', 'Sweatshirts'),
    ('pants', 'Pants'),
    ('t-shirts', 'T-Shirts'),
    ('hats', 'Hats'),
    ('bags', 'Bags'),
    ('accessories', 'Accessories'),
    ('shoes', 'Shoes'),
    ('gym', 'Gym'),
    ('skate', 'Skate'),
    ('all', 'All'),
]

item_template = """
<div class="product-item">
    <img src="https://via.placeholder.com/400x400" alt="{title} Item {i}">
    <div class="product-info">
        <p>{title} Item {i}</p>
        <p>${price}</p>
    </div>
</div>"""

for slug, title in categories:
    items = []
    for i, price in enumerate([100, 120, 140], 1):
        items.append(item_template.format(title=title, i=i, price=price))
    page = template.replace('{{TITLE}}', title).replace('{{ITEMS}}', '\n    '.join(items))
    filename = f"{slug}.html"
    with open(filename, 'w') as f:
        f.write(page)
    print(f"Wrote {filename}")
