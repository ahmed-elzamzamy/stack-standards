#!/usr/bin/env bash
# Usage: set-status.sh <issue-number> <status>
# Sets the issue's Status on the board (user project PROJECT_NUMBER owned by OWNER), adding the
# issue to the board first if it isn't there. Needs GH_TOKEN with the `project` scope.
set -euo pipefail
issue=$1 status=$2
repo=${GITHUB_REPOSITORY#*/}

read -r project field option < <(gh api graphql -F owner="$OWNER" -F number="$PROJECT_NUMBER" -f query='
  query($owner: String!, $number: Int!) {
    user(login: $owner) { projectV2(number: $number) { id
      field(name: "Status") { ... on ProjectV2SingleSelectField { id options { id name } } } } }
  }' --jq ".data.user.projectV2 | [.id, .field.id, (.field.options[] | select(.name == \"$status\") | .id)] | @tsv")
[ -n "${option:-}" ] || { echo "No Status option named '$status' on the board" >&2; exit 1; }

read -r issue_id item < <(gh api graphql -F owner="$OWNER" -F repo="$repo" -F number="$issue" -f query='
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) { issue(number: $number) { id
      projectItems(first: 20) { nodes { id project { id } } } } }
  }' --jq ".data.repository.issue | [.id, ((.projectItems.nodes[] | select(.project.id == \"$project\") | .id) // \"\")] | @tsv")

if [ -z "${item:-}" ]; then
  item=$(gh api graphql -f project="$project" -f content="$issue_id" -f query='
    mutation($project: ID!, $content: ID!) {
      addProjectV2ItemById(input: {projectId: $project, contentId: $content}) { item { id } }
    }' --jq .data.addProjectV2ItemById.item.id)
fi

gh api graphql -f project="$project" -f item="$item" -f field="$field" -f option="$option" -f query='
  mutation($project: ID!, $item: ID!, $field: ID!, $option: String!) {
    updateProjectV2ItemFieldValue(input: {projectId: $project, itemId: $item, fieldId: $field,
      value: {singleSelectOptionId: $option}}) { projectV2Item { id } }
  }' >/dev/null
echo "#$issue -> $status"
