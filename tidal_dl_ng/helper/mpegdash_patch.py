"""
mpegdash_patch.py

Monkey patch for the mpegdash library to handle non-integer group attributes in MPEG-DASH manifests.

This patch works around a bug in the mpegdash library where it expects the 'group' attribute
in AdaptationSet elements to always be an integer, but TIDAL sometimes provides string values
like 'main' for certain high-quality audio formats.

The patch wraps the original parse_attr_value function to handle the special case where:
- The attribute name is 'group'
- The value_type is int
- The attribute value is a string that can't be converted to int

In such cases, it returns None instead of raising a ValueError.
"""

import mpegdash.utils

# Store the original function
_original_parse_attr_value = mpegdash.utils.parse_attr_value


def patched_parse_attr_value(xmlnode, attr_name: str, value_type):
    """Patched version of parse_attr_value that handles non-integer group attributes.

    Args:
        xmlnode: The XML node to parse.
        attr_name (str): The name of the attribute to parse.
        value_type: The expected type of the attribute value.

    Returns:
        The parsed attribute value, or None if the attribute doesn't exist or can't be converted.
    """
    # Check if attribute exists
    if attr_name not in xmlnode.attributes:
        return None

    # Get attribute value
    attr_val = xmlnode.attributes[attr_name].nodeValue

    # Special handling for 'group' attribute that may be a string instead of int
    if attr_name == "group" and value_type == int:
        try:
            return int(attr_val)
        except ValueError:
            # Return None for non-integer group values like 'main'
            return None

    # Handle list types (from original implementation)
    if isinstance(value_type, list):
        import re

        attr_type = value_type[0] if len(value_type) > 0 else str
        return [attr_type(elem) for elem in re.split(r"[, ]", attr_val)]

    # Use original logic for all other cases
    try:
        return value_type(attr_val)
    except (ValueError, TypeError):
        return None


def apply_mpegdash_patch() -> None:
    """Apply the monkey patch to mpegdash.utils.parse_attr_value.

    This function replaces the original parse_attr_value function with a patched version
    that can handle non-integer group attributes in MPEG-DASH manifests.

    Should be called once at module initialization before any TIDAL API calls that might
    use DASH manifests.
    """
    mpegdash.utils.parse_attr_value = patched_parse_attr_value
