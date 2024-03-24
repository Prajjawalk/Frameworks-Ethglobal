export type RandomNumberRequestStateValue =
  | {
      error: string;
      status: "error";
      timestamp: number;
    }
  | {
      data: string;
      status: "success";
      timestamp: number;
    }
  | {
      error: string;
      status: "analytics";
      timestamp: number;
    }
  | {
      status: "pending";
      timestamp: number;
    };
