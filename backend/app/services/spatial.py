import math
from typing import List, Dict, Any, Tuple, Optional

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculates the great-circle distance between two GPS points in kilometers
    using the Haversine formula.
    """
    R = 6371.0  # Earth's mean radius in kilometers

    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)

    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    return round(R * c, 2)

def sort_and_filter_by_proximity(
    records: List[Any],
    target_lat: float,
    target_lon: float,
    radius_km: Optional[float] = 50.0
) -> List[Any]:
    """
    Computes distance_km for each record relative to (target_lat, target_lon),
    filters within radius_km, and returns records sorted by nearest distance.
    """
    results = []
    for item in records:
        lat = getattr(item, "latitude", None)
        lon = getattr(item, "longitude", None)
        
        if lat is not None and lon is not None:
            dist = haversine_distance(target_lat, target_lon, lat, lon)
            setattr(item, "distance_km", dist)
            if radius_km is None or dist <= radius_km:
                results.append(item)
        else:
            setattr(item, "distance_km", 9999.0)
            results.append(item)

    results.sort(key=lambda x: getattr(x, "distance_km", 9999.0))
    return results
