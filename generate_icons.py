#!/usr/bin/env python3
"""Generate PNG icons for PWA from SVG"""

from PIL import Image, ImageDraw
import os

def create_icon(size, filename):
    """Create a PNG icon with the task manager checkmark design"""
    # Create image with white background and rounded corners
    img = Image.new('RGBA', (size, size), (255, 255, 255, 255))
    draw = ImageDraw.Draw(img)

    # Calculate rounded corner radius (proportional to size)
    corner_radius = size // 4

    # Draw rounded rectangle background
    draw.rounded_rectangle(
        [(0, 0), (size, size)],
        radius=corner_radius,
        fill=(255, 255, 255, 255)
    )

    # Color: #8b7355 (beige/brown)
    color = (139, 115, 85, 255)

    # Scale stroke width based on size
    stroke_width = max(2, size // 10)

    # Draw checkmark (scaled to icon size)
    # Checkmark path: roughly at 3/8, 11/24 -> 1/2, 5/8 -> 5/6, 1/3
    scale = size / 24

    # Checkmark coordinates (scaled from SVG viewBox)
    check_points = [
        (int(9 * scale), int(11 * scale)),
        (int(12 * scale), int(14 * scale)),
        (int(20 * scale), int(6 * scale))
    ]

    draw.line(check_points, fill=color, width=stroke_width, joint='curve')

    # Draw clipboard outline
    # Top-left corner of clipboard
    clipboard_x = int(5 * scale)
    clipboard_y = int(5 * scale)
    clipboard_w = int(14 * scale)
    clipboard_h = int(14 * scale)

    # Partial top (the part after the checkmark)
    top_right_x = int(21 * scale)

    # Right side
    draw.line(
        [(top_right_x, clipboard_y), (top_right_x, clipboard_y + clipboard_h)],
        fill=color,
        width=stroke_width
    )

    # Bottom
    draw.line(
        [(top_right_x, clipboard_y + clipboard_h), (clipboard_x, clipboard_y + clipboard_h)],
        fill=color,
        width=stroke_width
    )

    # Left side
    draw.line(
        [(clipboard_x, clipboard_y + clipboard_h), (clipboard_x, clipboard_y)],
        fill=color,
        width=stroke_width
    )

    # Top left portion
    draw.line(
        [(clipboard_x, clipboard_y), (int(16 * scale), clipboard_y)],
        fill=color,
        width=stroke_width
    )

    # Save the image
    img.save(filename, 'PNG')
    print(f'Created {filename} ({size}x{size})')

# Generate icons in common sizes
create_icon(192, 'icon-192.png')
create_icon(512, 'icon-512.png')

print('\nIcons generated successfully!')
