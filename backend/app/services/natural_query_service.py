import re


def parse_natural_query(question: str):
    """
    Convert a user's natural-language question into
    a structured query that the backend can understand.
    """

    question = question.lower().strip()

    # ---------------------------------------------------------
    # 1. Detect intent
    # ---------------------------------------------------------

    if any(word in question for word in [
        "anomaly",
        "anomalies",
        "abnormal",
        "unusual",
        "heat anomaly",
        "temperature anomaly"
    ]):
        intent = "anomaly_query"

    elif any(word in question for word in [
        "thermocline",
        "temperature gradient",
        "strongest temperature gradient",
        "rapid temperature change"
    ]):
        intent = "thermocline_query"

    elif any(word in question for word in [
        "salinity gradient",
        "salt gradient",
        "strongest salinity gradient",
        "rapid salinity change"
    ]):
        intent = "salinity_gradient_query"

    elif any(word in question for word in [
        "trajectory",
        "track",
        "path of the float",
        "float path",
        "location history",
        "where did the float travel",
        "where has the float travelled",
        "where is the float going"
    ]):
        intent = "trajectory_query"

    elif any(word in question for word in [
        "profile analysis",
        "analyze profile",
        "analyse profile",
        "analyze this profile",
        "analyse this profile",
        "analyze the profile",
        "analyse the profile"
    ]):
        intent = "profile_analysis_query"

    else:
        intent = "data_query"

    # ---------------------------------------------------------
    # 2. Detect ocean variable
    # ---------------------------------------------------------

    variable = None

    if any(word in question for word in [
        "temperature",
        "temp",
        "thermal"
    ]):
        variable = "temperature"

    elif any(word in question for word in [
        "salinity",
        "salt"
    ]):
        variable = "salinity"

    elif any(word in question for word in [
        "pressure",
        "depth",
        "deep"
    ]):
        variable = "pressure"

    # ---------------------------------------------------------
    # 3. Detect depth range
    # ---------------------------------------------------------

    min_pressure = None
    max_pressure = None

    # Example:
    # "between 50 and 100 meters"
    range_match = re.search(
        r"between\s+(\d+(?:\.\d+)?)\s*(?:m|meter|meters)?"
        r"\s+and\s+(\d+(?:\.\d+)?)\s*(?:m|meter|meters)?",
        question
    )

    if range_match:
        min_pressure = float(range_match.group(1))
        max_pressure = float(range_match.group(2))

    # Example:
    # "from 50 to 100 meters"
    if min_pressure is None:

        from_to_match = re.search(
            r"from\s+(\d+(?:\.\d+)?)\s*(?:m|meter|meters)?"
            r"\s+to\s+(\d+(?:\.\d+)?)\s*(?:m|meter|meters)?",
            question
        )

        if from_to_match:
            min_pressure = float(from_to_match.group(1))
            max_pressure = float(from_to_match.group(2))

    # Example:
    # "50 to 100 meters"
    if min_pressure is None:

        simple_range_match = re.search(
            r"(\d+(?:\.\d+)?)\s*(?:m|meter|meters)"
            r"\s*(?:to|-)\s*"
            r"(\d+(?:\.\d+)?)\s*(?:m|meter|meters)?",
            question
        )

        if simple_range_match:
            min_pressure = float(simple_range_match.group(1))
            max_pressure = float(simple_range_match.group(2))

    # Example:
    # "below 100 meters"
    if min_pressure is None:

        below_match = re.search(
            r"below\s+(\d+(?:\.\d+)?)\s*(?:m|meter|meters)?",
            question
        )

        if below_match:
            min_pressure = float(below_match.group(1))

    # Example:
    # "deeper than 100 meters"
    if min_pressure is None:

        deeper_match = re.search(
            r"(?:deeper than|deeper)\s+"
            r"(\d+(?:\.\d+)?)\s*(?:m|meter|meters)?",
            question
        )

        if deeper_match:
            min_pressure = float(deeper_match.group(1))

    # Example:
    # "above 50 meters"
    if max_pressure is None:

        above_match = re.search(
            r"above\s+(\d+(?:\.\d+)?)\s*(?:m|meter|meters)?",
            question
        )

        if above_match:
            max_pressure = float(above_match.group(1))

    # Example:
    # "at 500 meters", "at 500m", "500m depth", "500 meters"
    target_depth = None
    if min_pressure is None and max_pressure is None:
        at_match = re.search(
            r"(?:at|around|depth\s*(?:of)?)\s+(\d+(?:\.\d+)?)\s*(?:m|meter|meters)?",
            question
        )
        if not at_match:
            at_match = re.search(
                r"(\d+(?:\.\d+)?)\s*(?:m|meter|meters)\s*(?:depth)?",
                question
            )

        if at_match:
            val = float(at_match.group(1))
            target_depth = val
            # Window of +/- 20m for filtering
            min_pressure = max(0.0, val - 25.0)
            max_pressure = val + 25.0

    # ---------------------------------------------------------
    # 4. Detect profile number
    # ---------------------------------------------------------

    profile_index = 100  # Default to representative full-depth profile (reaches >2000m)

    profile_match = re.search(
        r"profile\s*#?\s*(\d+)",
        question
    )

    if profile_match:
        profile_index = int(profile_match.group(1))
    elif min_pressure is not None and min_pressure <= 140 and (max_pressure is None or max_pressure <= 140):
        # Surface or shallow check can use profile 0
        profile_index = 0

    # ---------------------------------------------------------
    # 5. Return structured interpretation
    # ---------------------------------------------------------

    return {
        "question": question,
        "intent": intent,
        "profile_index": profile_index,
        "variable": variable,
        "min_pressure": min_pressure,
        "max_pressure": max_pressure,
        "target_depth": target_depth
    }