use std::collections::BTreeSet;
use std::env;
use std::fs;

#[derive(Debug, Clone)]
struct Request {
    calorie_goal: f64,
    protein_target: f64,
    carbs_target: f64,
    fat_target: f64,
    restrictions: Vec<String>,
    groceries: Vec<String>,
    recovery_time_hours: f64,
    progress_score: f64,
    meals: Vec<MealPlan>,
    workouts: Vec<WorkoutPlan>,
}

#[derive(Debug, Clone)]
struct MealPlan {
    name: String,
    calories: f64,
    protein: f64,
    carbs: f64,
    fat: f64,
    ingredients: Vec<String>,
}

#[derive(Debug, Clone)]
struct WorkoutPlan {
    name: String,
    intensity: f64,
    duration_minutes: f64,
    muscle_groups: Vec<String>,
}

#[derive(Debug)]
struct RankedPlan {
    name: String,
    plan_type: &'static str,
    score: f64,
    reason: String,
}

fn main() {
    let path = env::args().nth(1).unwrap_or_else(|| {
        eprintln!("Usage: statforge-optimizer <request.json>");
        std::process::exit(2);
    });

    let raw = fs::read_to_string(&path).unwrap_or_else(|err| {
        eprintln!("Could not read {path}: {err}");
        std::process::exit(1);
    });

    let request = parse_request(&raw).unwrap_or_else(|err| {
        eprintln!("Invalid optimizer request: {err}");
        std::process::exit(1);
    });

    let ranked = rank_plans(&request);
    println!("{}", to_json(&ranked));
}

fn rank_plans(request: &Request) -> Vec<RankedPlan> {
    let grocery_set = normalized_set(&request.groceries);
    let restriction_set = normalized_set(&request.restrictions);
    let mut ranked = Vec::new();

    for meal in &request.meals {
        let calorie_fit = closeness(meal.calories, request.calorie_goal, request.calorie_goal);
        let protein_fit = closeness(meal.protein, request.protein_target, request.protein_target);
        let carbs_fit = closeness(meal.carbs, request.carbs_target, request.carbs_target);
        let fat_fit = closeness(meal.fat, request.fat_target, request.fat_target);
        let macro_fit = (protein_fit * 0.45) + (carbs_fit * 0.3) + (fat_fit * 0.25);
        let grocery_fit = coverage(&meal.ingredients, &grocery_set);
        let restriction_penalty = if violates_restrictions(&meal.ingredients, &restriction_set) { 0.45 } else { 0.0 };
        let score = ((calorie_fit * 0.36) + (macro_fit * 0.39) + (grocery_fit * 0.25) - restriction_penalty)
            .clamp(0.0, 1.0);

        ranked.push(RankedPlan {
            name: meal.name.clone(),
            plan_type: "meal",
            score,
            reason: format!(
                "calorie fit {:.0}%, macro fit {:.0}%, grocery coverage {:.0}%",
                calorie_fit * 100.0,
                macro_fit * 100.0,
                grocery_fit * 100.0
            ),
        });
    }

    for workout in &request.workouts {
        let recovery_fit = recovery_score(workout.intensity, request.recovery_time_hours);
        let duration_fit = closeness(workout.duration_minutes, 60.0, 60.0);
        let progress_boost = (1.0 - request.progress_score).clamp(0.0, 1.0) * 0.12;
        let variety = (workout.muscle_groups.len() as f64 / 4.0).min(1.0);
        let score = ((recovery_fit * 0.46) + (duration_fit * 0.2) + (variety * 0.22) + progress_boost)
            .clamp(0.0, 1.0);

        ranked.push(RankedPlan {
            name: workout.name.clone(),
            plan_type: "workout",
            score,
            reason: format!(
                "recovery fit {:.0}%, duration fit {:.0}%, variety {:.0}%",
                recovery_fit * 100.0,
                duration_fit * 100.0,
                variety * 100.0
            ),
        });
    }

    ranked.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap());
    ranked
}

fn closeness(value: f64, target: f64, scale: f64) -> f64 {
    if target <= 0.0 || scale <= 0.0 {
        return 0.0;
    }
    (1.0 - ((value - target).abs() / scale)).clamp(0.0, 1.0)
}

fn coverage(items: &[String], available: &BTreeSet<String>) -> f64 {
    if items.is_empty() {
        return 1.0;
    }
    let matched = items.iter().filter(|item| available.contains(&item.to_lowercase())).count();
    matched as f64 / items.len() as f64
}

fn violates_restrictions(items: &[String], restrictions: &BTreeSet<String>) -> bool {
    items.iter().any(|item| restrictions.contains(&item.to_lowercase()))
}

fn recovery_score(intensity: f64, recovery_hours: f64) -> f64 {
    let needed = 8.0 + (intensity.clamp(1.0, 10.0) * 5.5);
    (recovery_hours / needed).min(1.0)
}

fn normalized_set(items: &[String]) -> BTreeSet<String> {
    items.iter().map(|item| item.to_lowercase()).collect()
}

fn to_json(ranked: &[RankedPlan]) -> String {
    let rows: Vec<String> = ranked
        .iter()
        .map(|plan| {
            format!(
                "{{\"name\":\"{}\",\"type\":\"{}\",\"score\":{},\"reason\":\"{}\"}}",
                escape(&plan.name),
                plan.plan_type,
                (plan.score * 1000.0).round() / 1000.0,
                escape(&plan.reason)
            )
        })
        .collect();
    format!("[{}]", rows.join(","))
}

fn escape(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn parse_request(raw: &str) -> Result<Request, String> {
    Ok(Request {
        calorie_goal: number(raw, "calorie_goal")?,
        protein_target: nested_number(raw, "macro_targets", "protein")?,
        carbs_target: nested_number(raw, "macro_targets", "carbs")?,
        fat_target: nested_number(raw, "macro_targets", "fat")?,
        restrictions: string_array(raw, "dietary_restrictions")?,
        groceries: string_array(raw, "available_groceries")?,
        recovery_time_hours: number(raw, "recovery_time_hours")?,
        progress_score: number(raw, "progress_score")?,
        meals: meal_plans(raw)?,
        workouts: workout_plans(raw)?,
    })
}

fn number(raw: &str, key: &str) -> Result<f64, String> {
    let value = after_key(raw, key)?;
    let token: String = value
        .chars()
        .skip_while(|ch| ch.is_whitespace() || *ch == ':')
        .take_while(|ch| ch.is_ascii_digit() || *ch == '.')
        .collect();
    token.parse::<f64>().map_err(|_| format!("missing numeric field {key}"))
}

fn nested_number(raw: &str, object_key: &str, key: &str) -> Result<f64, String> {
    let object = object_body(raw, object_key)?;
    number(object, key)
}

fn string_array(raw: &str, key: &str) -> Result<Vec<String>, String> {
    let body = array_body(raw, key)?;
    Ok(body
        .split(',')
        .filter_map(|part| {
            let trimmed = part.trim();
            if trimmed.starts_with('"') && trimmed.ends_with('"') {
                Some(trimmed.trim_matches('"').to_string())
            } else {
                None
            }
        })
        .collect())
}

fn meal_plans(raw: &str) -> Result<Vec<MealPlan>, String> {
    let body = array_body(raw, "meal_plans")?;
    object_chunks(body)
        .iter()
        .map(|chunk| {
            Ok(MealPlan {
                name: string_field(chunk, "name")?,
                calories: number(chunk, "calories")?,
                protein: number(chunk, "protein")?,
                carbs: number(chunk, "carbs")?,
                fat: number(chunk, "fat")?,
                ingredients: string_array(chunk, "ingredients")?,
            })
        })
        .collect()
}

fn workout_plans(raw: &str) -> Result<Vec<WorkoutPlan>, String> {
    let body = array_body(raw, "workout_plans")?;
    object_chunks(body)
        .iter()
        .map(|chunk| {
            Ok(WorkoutPlan {
                name: string_field(chunk, "name")?,
                intensity: number(chunk, "intensity")?,
                duration_minutes: number(chunk, "duration_minutes")?,
                muscle_groups: string_array(chunk, "muscle_groups")?,
            })
        })
        .collect()
}

fn string_field(raw: &str, key: &str) -> Result<String, String> {
    let value = after_key(raw, key)?;
    let start = value.find('"').ok_or_else(|| format!("missing string field {key}"))? + 1;
    let rest = &value[start..];
    let end = rest.find('"').ok_or_else(|| format!("unterminated string field {key}"))?;
    Ok(rest[..end].to_string())
}

fn after_key<'a>(raw: &'a str, key: &str) -> Result<&'a str, String> {
    let needle = format!("\"{key}\"");
    let index = raw.find(&needle).ok_or_else(|| format!("missing field {key}"))?;
    Ok(&raw[index + needle.len()..])
}

fn object_body<'a>(raw: &'a str, key: &str) -> Result<&'a str, String> {
    delimited_body(raw, key, '{', '}')
}

fn array_body<'a>(raw: &'a str, key: &str) -> Result<&'a str, String> {
    delimited_body(raw, key, '[', ']')
}

fn delimited_body<'a>(raw: &'a str, key: &str, open: char, close: char) -> Result<&'a str, String> {
    let after = after_key(raw, key)?;
    let start = after.find(open).ok_or_else(|| format!("missing {open} for {key}"))?;
    let mut depth = 0;
    let mut body_start = None;
    for (offset, ch) in after[start..].char_indices() {
        if ch == open {
            depth += 1;
            if body_start.is_none() {
                body_start = Some(start + offset + 1);
            }
        } else if ch == close {
            depth -= 1;
            if depth == 0 {
                return Ok(&after[body_start.unwrap()..start + offset]);
            }
        }
    }
    Err(format!("unterminated field {key}"))
}

fn object_chunks(raw: &str) -> Vec<String> {
    let mut chunks = Vec::new();
    let mut depth = 0;
    let mut start = None;

    for (index, ch) in raw.char_indices() {
        if ch == '{' {
            if depth == 0 {
                start = Some(index);
            }
            depth += 1;
        } else if ch == '}' {
            depth -= 1;
            if depth == 0 {
                if let Some(start_index) = start {
                    chunks.push(raw[start_index..=index].to_string());
                }
            }
        }
    }

    chunks
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ranks_meals_and_workouts() {
        let raw = include_str!("../../backend/sample_optimizer_request.json");
        let request = parse_request(raw).unwrap();
        let ranked = rank_plans(&request);

        assert_eq!(ranked[0].name, "Lean Bulk Bowl");
        assert!(ranked[0].score > ranked.last().unwrap().score);
    }
}
