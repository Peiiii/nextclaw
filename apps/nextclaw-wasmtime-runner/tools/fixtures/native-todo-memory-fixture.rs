use std::io::{self, BufRead, Write};

fn main() {
    let stdin = io::stdin();
    let mut stdout = io::BufWriter::new(io::stdout().lock());
    let mut todos = vec![String::from("measure native rust")];

    writeln!(stdout, "ready").expect("write ready");
    stdout.flush().expect("flush ready");

    for line in stdin.lock().lines() {
        let line = match line {
            Ok(line) => line,
            Err(_) => break,
        };
        if line == "list" {
            writeln!(stdout, "{}", todos.len()).expect("write list result");
        } else if let Some(title) = line.strip_prefix("add:") {
            todos.push(title.to_owned());
            writeln!(stdout, "{}", todos.len()).expect("write add result");
        } else if line == "stop" {
            writeln!(stdout, "stopped").expect("write stop result");
            stdout.flush().expect("flush stop result");
            break;
        } else {
            writeln!(stdout, "error").expect("write error result");
        }
        stdout.flush().expect("flush result");
    }
}
