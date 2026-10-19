package handler

import "testing"

func TestJoinAgentInstructionParts(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		parts []string
		want  string
	}{
		{name: "empty", parts: nil, want: ""},
		{name: "drops empty layers", parts: []string{"", "  ", "agent"}, want: "agent"},
		{name: "role before agent", parts: []string{" role ", "agent"}, want: "role\n\nagent"},
		{name: "three layers", parts: []string{"default", "role", "agent"}, want: "default\n\nrole\n\nagent"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := joinAgentInstructionParts(tt.parts...); got != tt.want {
				t.Fatalf("joinAgentInstructionParts(%q) = %q, want %q", tt.parts, got, tt.want)
			}
		})
	}
}
