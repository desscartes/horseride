"""Select an experiment on earlier validation metrics, never on its final test."""
import math

def choose_validation_index(metrics, objective='log_loss'):
    if objective not in ('log_loss','top_one'):
        raise ValueError('Unknown validation objective')
    if not metrics:
        raise ValueError('No validation candidates')
    for row in metrics:
        if any(not isinstance(row.get(key),(int,float)) or not math.isfinite(row[key]) for key in ('logLoss','topOne','brier')):
            raise ValueError('Incomplete validation metrics')
    key=(lambda i:(-metrics[i]['topOne'],metrics[i]['brier'],metrics[i]['logLoss'])) if objective=='top_one' else (lambda i:metrics[i]['logLoss'])
    return min(range(len(metrics)),key=key)
